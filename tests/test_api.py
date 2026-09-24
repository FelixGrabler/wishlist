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
    return client.get("/people").json()["Anna"]["items"][-1]["id"]


def test_edit_preserves_identity_and_completion(client):
    assert person(client).status_code == 200
    item_id = add(client)
    path = f"/people/anna/items/{item_id}"
    assert client.post(path + "/complete", json={"completed": True}).json()["completed"]
    assert client.put(path, data={"item_name": " New book ", "item_link": "https://example.com"}).status_code == 200
    item = client.get("/people").json()["Anna"]["items"][0]
    assert item == dict(id=item_id, name="New book", completed=True, url="https://example.com", image=None)
    assert client.put(path, data={"item_name": "New book", "item_image": "https://example.com/image.png"}).status_code == 200
    assert client.put(path, data={"item_name": "New book"}).status_code == 200
    assert client.get("/people").json()["Anna"]["items"][0]["image"] is None


def test_duplicate_edit_rolls_back_and_cannot_edit_another_person(client):
    person(client)
    first = add(client)
    add(client, "Bike")
    assert client.put(f"/people/Anna/items/{first}", data={"item_name": "Bike"}).status_code == 409
    assert client.get("/people").json()["Anna"]["items"][0]["name"] == "Book"
    person(client, "Ben")
    assert client.put(f"/people/Ben/items/{first}", data={"item_name": "Stolen"}).status_code == 404


@pytest.mark.parametrize("name", [" ", "a/b", "..", "API", "a" * 201])
def test_bad_person_names(client, name):
    assert person(client, name).status_code == 422


def test_person_uniqueness_and_empty_list(client):
    assert person(client, " Anna ").status_code == 200
    assert person(client, "anna").status_code == 409
    assert client.get("/people").json() == {"Anna": {"color": "#123456", "items": []}}


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
    assert client.get("/people").json()["Anna"]["items"] == []


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
    assert client.get("/people").json()["Anna"]["items"][0]["image"] == image
