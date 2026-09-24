from fastapi import APIRouter, Body, Form, HTTPException
from fastapi.routing import APIRoute
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from database import engine
import base64
import binascii
import re
from urllib.parse import urlsplit
from typing import Optional, Tuple


class ImageFormRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def handle(request):
            content_type = request.headers.get("content-type", "").split(";")[0]
            if content_type in {"application/x-www-form-urlencoded", "multipart/form-data"}:
                # Base64 and URL encoding expand a 5 MB image. Keep a bounded
                # parser limit aligned with nginx instead of the 1 MB default.
                try:
                    await request.form(max_files=0, max_fields=3, max_part_size=15 * 1024 * 1024)
                except StarletteHTTPException as exc:
                    if "maximum size" in str(exc.detail):
                        raise HTTPException(413, "Das Bild darf höchstens 5 MB groß sein.") from exc
                    raise
            return await handler(request)

        return handle


router = APIRouter(route_class=ImageFormRoute)


def clean_name(value: str, *, person=False):
    value = value.strip()
    if not value or len(value) > 200 or any(ord(c) < 32 for c in value):
        raise HTTPException(422, "Der Name muss zwischen 1 und 200 Zeichen lang sein.")
    if person and ("/" in value or value in {".", ".."} or value.lower() in {"api", "assets", "styles", "js", "templates", "edit"}):
        raise HTTPException(422, "Dieser Personenname kann nicht als Adresse verwendet werden.")
    return value


def clean_link(value):
    value = (value or "").strip()
    if not value:
        return None
    try:
        parsed = urlsplit(value)
        valid = parsed.scheme in {"http", "https"} and parsed.hostname and not parsed.username and not parsed.password
    except ValueError:
        valid = False
    if not valid or len(value) > 2048 or any(c.isspace() for c in value):
        raise HTTPException(422, "Bitte einen gültigen HTTP- oder HTTPS-Link eingeben.")
    return value


def clean_image(value):
    value = (value or "").strip()
    if not value:
        return None
    if not value.startswith("data:"):
        return clean_link(value)
    if len(value) > 7_000_000:
        raise HTTPException(413, "Das Bild darf höchstens 5 MB groß sein.")
    match = re.fullmatch(r"data:image/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)", value)
    if not match:
        raise HTTPException(422, "Bitte ein PNG-, JPEG-, GIF- oder WebP-Bild verwenden.")
    try:
        raw = base64.b64decode(match[2], validate=True)
    except binascii.Error:
        raise HTTPException(422, "Ungültiges Bild.")
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(413, "Das Bild darf höchstens 5 MB groß sein.")
    signatures = {
        "png": raw.startswith(b"\x89PNG\r\n\x1a\n"),
        "jpeg": raw.startswith(b"\xff\xd8\xff"),
        "gif": raw.startswith((b"GIF87a", b"GIF89a")),
        "webp": raw.startswith(b"RIFF") and raw[8:12] == b"WEBP",
    }
    if not signatures[match[1]]:
        raise HTTPException(422, "Ungültiges Bildformat.")
    return value


@router.get("/people")
def list_people():
    result = {}
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT p.name, p.color, i.id, i.name, i.completed, i.url, i.image
            FROM people p LEFT JOIN items i ON i.person_name = p.name
            ORDER BY LOWER(p.name), p.name, i.id
        """))
        for name, color, item_id, item_name, completed, url, image in rows:
            person = result.setdefault(name, {"color": color, "items": []})
            if item_id is not None:
                person["items"].append(dict(id=item_id, name=item_name,
                    completed=bool(completed), url=url, image=image))
    return result


@router.post("/people")
def add_person(name: str = Form(...), color: str = Form(...)):
    name = clean_name(name, person=True)
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
        raise HTTPException(422, "Bitte eine gültige Farbe auswählen.")
    try:
        with engine.begin() as conn:
            # Serialize creation so differently capitalized names cannot race.
            if engine.dialect.name == "postgresql":
                conn.execute(text("LOCK TABLE people IN SHARE ROW EXCLUSIVE MODE"))
            if conn.execute(text("SELECT 1 FROM people WHERE LOWER(name) = LOWER(:name)"), {"name": name}).first():
                raise HTTPException(409, "Diese Person existiert bereits.")
            conn.execute(
                text("INSERT INTO people (name, color) VALUES (:name, :color)"),
                {"name": name, "color": color},
            )
        return {"message": f"Person '{name}' added"}
    except IntegrityError:
        raise HTTPException(status_code=400, detail="Person already exists")


@router.delete("/people/{person}")
def delete_person(person: str):
    with engine.begin() as conn:
        # The parent row lock also blocks concurrent inserts through the FK.
        # Check items after acquiring it so no wish can be silently cascaded away.
        owner = conn.execute(text(
            "SELECT name FROM people WHERE LOWER(name) = LOWER(:person) FOR UPDATE"
        ), {"person": person}).first()
        if owner is None:
            raise HTTPException(404, "Person nicht gefunden.")
        if conn.execute(text("SELECT 1 FROM items WHERE person_name = :person LIMIT 1"),
                        {"person": owner[0]}).first():
            raise HTTPException(409, "Bitte zuerst alle Wünsche dieser Person entfernen.")
        conn.execute(text("DELETE FROM people WHERE name = :person"), {"person": owner[0]})
    return {"message": "Person gelöscht"}


@router.post("/people/{person}/items/{item_id}/complete")
def toggle_item_completion(
    person: str, item_id: int, completed: Optional[bool] = Body(None, embed=True)
):
    return _toggle_item_completion(person, completed, identifier_key="id", identifier_value=item_id)


@router.post("/people/{person}/items-by-name/{item_name}/complete")
def toggle_item_completion_by_name(
    person: str, item_name: str, completed: Optional[bool] = Body(None, embed=True)
):
    return _toggle_item_completion(
        person, completed, identifier_key="name", identifier_value=item_name
    )


@router.post("/people/{person}/items")
def add_item(
    person: str,
    item_name: str = Form(...),
    item_link: Optional[str] = Form(None),
    item_image: Optional[str] = Form(None),
):
    with engine.connect() as conn:
        person_exists = conn.execute(
            text("SELECT 1 FROM people WHERE LOWER(name) = LOWER(:person)"),
            {"person": person},
        ).first()

    if not person_exists:
        raise HTTPException(status_code=404, detail="Person not found")

    item_name = clean_name(item_name)
    link_value = clean_link(item_link)
    image_value = clean_image(item_image)

    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO items (person_name, name, url, image)
                    VALUES (
                        (SELECT name FROM people WHERE LOWER(name) = LOWER(:person)),
                        :item_name,
                        :item_link,
                        :item_image
                    )
                """
                ),
                {
                    "person": person,
                    "item_name": item_name,
                    "item_link": link_value,
                    "item_image": image_value,
                },
            )
        return {"message": "Item added"}
    except IntegrityError:
        raise HTTPException(
            status_code=400, detail="Item already exists for this person"
        )


@router.put("/people/{person}/items/{item_id}")
def edit_item(
    person: str, item_id: int,
    item_name: str = Form(...),
    item_link: Optional[str] = Form(None),
    item_image: Optional[str] = Form(None),
):
    values = dict(person=person, item_id=item_id, name=clean_name(item_name),
                  url=clean_link(item_link), image=clean_image(item_image))
    try:
        with engine.begin() as conn:
            row = conn.execute(text("""
                UPDATE items SET name = :name, url = :url, image = :image
                WHERE LOWER(person_name) = LOWER(:person) AND id = :item_id
                RETURNING id
            """), values).first()
            if row is None:
                raise HTTPException(404, "Wunsch nicht gefunden.")
    except IntegrityError:
        raise HTTPException(409, "Ein Wunsch mit diesem Namen existiert bereits.")
    return {"message": "Wunsch gespeichert", "id": row[0]}


@router.delete("/people/{person}/items/{item_id}")
def delete_item(person: str, item_id: int):
    return _delete_item(person, identifier_key="id", identifier_value=item_id)


@router.delete("/people/{person}/items-by-name/{item_name}")
def delete_item_by_name(person: str, item_name: str):
    return _delete_item(person, identifier_key="name", identifier_value=item_name)


def _item_identifier_parts(identifier_key: str) -> Tuple[str, str]:
    if identifier_key == "id":
        return "id", "item_id"
    if identifier_key == "name":
        return "name", "item_name"
    raise ValueError("Unsupported identifier type")


def _toggle_item_completion(
    person: str,
    completed: Optional[bool],
    *,
    identifier_key: str,
    identifier_value,
):
    column, placeholder = _item_identifier_parts(identifier_key)
    with engine.begin() as conn:
        params = {"person": person, placeholder: identifier_value}
        result = conn.execute(
            text(
                f"""
                SELECT completed
                FROM items
                WHERE LOWER(person_name) = LOWER(:person) AND {column} = :{placeholder}
                FOR UPDATE
            """
            ),
            params,
        )
        row = result.first()
        if not row:
            raise HTTPException(status_code=404, detail="Item not found")

        current_status = bool(row[0])
        new_status = not current_status if completed is None else bool(completed)

        if new_status == current_status:
            return {
                "message": "Item completion status unchanged",
                "completed": current_status,
            }

        conn.execute(
            text(
                f"""
                UPDATE items
                SET completed = :new_status
                WHERE LOWER(person_name) = LOWER(:person) AND {column} = :{placeholder}
            """
            ),
            {**params, "new_status": new_status},
        )
    return {"message": "Item completion status updated", "completed": new_status}


def _delete_item(person: str, *, identifier_key: str, identifier_value):
    with engine.connect() as conn:
        person_exists = conn.execute(
            text("SELECT 1 FROM people WHERE LOWER(name) = LOWER(:person)"),
            {"person": person},
        ).first()

    if not person_exists:
        raise HTTPException(status_code=404, detail="Person not found")

    column, placeholder = _item_identifier_parts(identifier_key)
    with engine.begin() as conn:
        result = conn.execute(
            text(
                f"""
                DELETE FROM items
                WHERE LOWER(person_name) = LOWER(:person) AND {column} = :{placeholder}
                RETURNING id
            """
            ),
            {"person": person, placeholder: identifier_value},
        ).first()

        if not result:
            raise HTTPException(status_code=404, detail="Item not found")

    return {"message": "Item deleted"}
