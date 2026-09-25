"""Integration tests: TEST_DATABASE_URL must point to a disposable PostgreSQL DB."""
import os
import sys
from pathlib import Path

import pytest

if not os.getenv("TEST_DATABASE_URL"):
    pytest.skip("Set TEST_DATABASE_URL to a disposable PostgreSQL database", allow_module_level=True)
os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from fastapi.testclient import TestClient
from sqlalchemy import text
from main import app
from database import engine


@pytest.fixture
def client():
    with TestClient(app) as client:
        with engine.begin() as conn:
            conn.execute(text("TRUNCATE items, people RESTART IDENTITY CASCADE"))
        yield client


def person(client, name="Anna"):
    return client.post("/people", data={"name": name, "color": "#123456"})


def add(client, name="Book"):
    response = client.post("/people/Anna/items", data={"item_name": name})
    assert response.status_code == 200
    return client.get("/people/Anna").json()["items"][-1]["id"]


def test_edit_preserves_identity_and_completion(client):
    assert person(client).status_code == 200
    item_id = add(client)
    path = f"/people/anna/items/{item_id}"
    assert client.post(path + "/complete", json={"completed": True}).json()["completed"]
    assert client.put(path, data={"item_name": " New book ", "item_link": "https://example.com"}).status_code == 200
    item = client.get("/people/Anna").json()["items"][0]
    assert item == dict(id=item_id, name="New book", completed=True, url="https://example.com", image=None)
    assert client.put(path, data={"item_name": "New book", "item_image": "https://example.com/image.png"}).status_code == 200
    assert client.put(path, data={"item_name": "New book"}).status_code == 200
    assert client.get("/people/Anna").json()["items"][0]["image"] is None


def test_duplicate_edit_rolls_back_and_cannot_edit_another_person(client):
    person(client)
    first = add(client)
    add(client, "Bike")
    assert client.put(f"/people/Anna/items/{first}", data={"item_name": "Bike"}).status_code == 409
    assert client.get("/people/Anna").json()["items"][0]["name"] == "Book"
    person(client, "Ben")
    assert client.put(f"/people/Ben/items/{first}", data={"item_name": "Stolen"}).status_code == 404


@pytest.mark.parametrize("name", [" ", "a/b", "..", "API", "a" * 201])
def test_bad_person_names(client, name):
    assert person(client, name).status_code == 422


def test_person_uniqueness_and_empty_list(client):
    assert person(client, " Anna ").status_code == 200
    assert person(client, "anna").status_code == 409
    assert client.get("/people").json() == {"Anna": {"color": "#123456", "item_count": 0}}


@pytest.mark.parametrize("fields", [
    {"item_name": " "},
    {"item_name": "Gift", "item_link": "javascript:alert(1)"},
    {"item_name": "Gift", "item_link": "https://"},
    {"item_name": "Gift", "item_image": "data:image/svg+xml;base64,PHN2Zz4="},
    {"item_name": "Gift", "item_image": "data:image/png;base64,aGVsbG8="},
])
def test_invalid_items(client, fields):
    person(client)
    assert client.post("/people/Anna/items", data=fields).status_code == 422
    assert client.get("/people/Anna").json()["items"] == []


def test_delete_and_idempotent_completion(client):
    person(client)
    item_id = add(client)
    path = f"/people/Anna/items/{item_id}"
    for _ in range(2):
        assert client.post(path + "/complete", json={"completed": True}).json()["completed"]
    assert client.post(path + "/complete").json()["completed"] is False
    assert client.delete(path).status_code == 200
    assert client.delete(path).status_code == 404
    assert client.post(path + "/complete").status_code == 404


def test_image_size_limit(client):
    person(client)
    assert client.post("/people/Anna/items", data={"item_name": "Gift", "item_image": "data:image/png;base64," + "A" * 7_000_000}).status_code == 413


def test_image_above_default_form_limit_round_trips(client):
    import base64
    person(client)
    raw = (Path(__file__).resolve().parents[1] / "frontend/assets/frame.jpg").read_bytes()
    image = "data:image/jpeg;base64," + base64.b64encode(raw + b"\x00" * 1_100_000).decode()
    response = client.post("/people/Anna/items", data={"item_name": "Picture", "item_image": image})
    assert response.status_code == 200
    stored = client.get("/people/Anna").json()["items"][0]["image"]
    assert stored.startswith("data:image/webp;base64,")
    assert len(base64.b64decode(stored.split(",", 1)[1])) <= 30 * 1024


def test_delete_person_requires_empty_wishlist(client):
    person(client)
    person(client, "Ben")
    item_id = add(client)
    assert client.delete("/people/Anna").status_code == 409
    client.post(f"/people/Anna/items/{item_id}/complete", json={"completed": True})
    assert client.delete("/people/anna").status_code == 409
    assert len(client.get("/people/Anna").json()["items"]) == 1
    client.delete(f"/people/Anna/items/{item_id}")
    assert client.delete("/people/anna").status_code == 200
    assert set(client.get("/people").json()) == {"Ben"}
    assert client.delete("/people/Anna").status_code == 404


def test_person_delete_waits_for_pending_item_insert(client):
    from concurrent.futures import ThreadPoolExecutor, TimeoutError
    person(client)
    with engine.connect() as conn:
        transaction = conn.begin()
        conn.execute(text("INSERT INTO items (person_name, name) VALUES ('Anna', 'Pending')"))
        with ThreadPoolExecutor() as executor:
            deletion = executor.submit(client.delete, "/people/Anna")
            try:
                with pytest.raises(TimeoutError):
                    deletion.result(timeout=0.2)
            finally:
                transaction.commit()
            assert deletion.result(timeout=5).status_code == 409
    assert client.get("/people/Anna").json()["items"][0]["name"] == "Pending"


def test_overview_excludes_legacy_images_and_detail_is_person_scoped(client):
    person(client)
    person(client, "Ben")
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO items (person_name, name, image) VALUES ('Anna', 'Legacy', :image)"),
                     {"image": "data:image/png;base64," + "A" * 2_000_000})
    overview = client.get("/people")
    assert len(overview.content) < 200
    assert overview.json() == {"Anna": {"color": "#123456", "item_count": 1},
                               "Ben": {"color": "#123456", "item_count": 0}}
    assert client.get("/people/ben").json() == {"name": "Ben", "color": "#123456", "items": []}
    assert client.get("/people/anna").json()["items"][0]["name"] == "Legacy"
    assert client.get("/people/Missing").status_code == 404


@pytest.mark.parametrize("size", [(1200, 600), (600, 1200), (80, 40)])
def test_uploaded_images_fit_without_cropping_or_upscaling(client, size):
    import base64
    from io import BytesIO
    from PIL import Image
    person(client)
    image = Image.new("RGBA", size, (255, 0, 0, 0))
    image.paste((0, 0, 255, 255), (size[0] // 2, 0, size[0], size[1]))
    source = BytesIO()
    image.save(source, format="PNG")
    value = "data:image/png;base64," + base64.b64encode(source.getvalue()).decode()
    assert client.post("/people/Anna/items", data={"item_name": "Picture", "item_image": value}).status_code == 200
    stored = client.get("/people/Anna").json()["items"][0]["image"]
    raw = base64.b64decode(stored.split(",", 1)[1])
    assert len(raw) <= 30 * 1024
    with Image.open(BytesIO(raw)) as result:
        scale = min(1, 400 / max(size))
        assert result.size == (round(size[0] * scale), round(size[1] * scale))
        assert result.getpixel((0, 0))[3] == 0
        assert result.getpixel((result.width - 1, 0))[2] > 240


def test_upload_honors_camera_orientation_and_compresses_noisy_images(client):
    import base64
    from io import BytesIO
    from PIL import Image
    person(client)
    for name, source_image, fmt, mime in [
        ("Rotated", Image.new("RGB", (800, 400), "red"), "JPEG", "jpeg"),
        ("Noise", Image.frombytes("RGB", (1000, 1000), os.urandom(3_000_000)), "PNG", "png"),
    ]:
        buffer = BytesIO()
        kwargs = {}
        if name == "Rotated":
            exif = Image.Exif()
            exif[274] = 6
            kwargs["exif"] = exif
        source_image.save(buffer, format=fmt, **kwargs)
        value = f"data:image/{mime};base64," + base64.b64encode(buffer.getvalue()).decode()
        assert client.post("/people/Anna/items", data={"item_name": name, "item_image": value}).status_code == 200
        stored = client.get("/people/Anna").json()["items"][-1]["image"]
        raw = base64.b64decode(stored.split(",", 1)[1])
        assert len(raw) <= 30 * 1024
        with Image.open(BytesIO(raw)) as result:
            assert max(result.size) <= 400
            if name == "Rotated":
                assert result.size == (200, 400)
                assert not result.info.get("exif")
