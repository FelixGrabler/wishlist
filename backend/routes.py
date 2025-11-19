from fastapi import Body, Form, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from main import app, engine
from typing import Optional, Tuple


@app.get("/people")
def list_people():
    result = {}
    with engine.connect() as conn:
        # Get all people and their colors
        people = conn.execute(text("SELECT name, color FROM people")).fetchall()

    if not people:
        # Return empty object if no people exist
        return {}

    with engine.connect() as conn:
        # Get all items for each person
        for person_name, color in people:
            items = conn.execute(
                text(
                    """
                    SELECT id, name, completed, url, image
                    FROM items
                    WHERE LOWER(person_name) = LOWER(:person_name)
                """
                ),
                {"person_name": person_name},
            ).fetchall()
            result[person_name] = {
                "items": [
                    {
                        "id": item[0],
                        "name": item[1],
                        "completed": bool(item[2]),
                        "url": item[3],
                        "image": item[4],
                    }
                    for item in items
                ],
                "color": color,
            }

    return result


@app.post("/people")
def add_person(name: str = Form(...), color: str = Form(...)):
    try:
        with engine.begin() as conn:
            conn.execute(
                text("INSERT INTO people (name, color) VALUES (:name, :color)"),
                {"name": name, "color": color},
            )
        return {"message": f"Person '{name}' added"}
    except IntegrityError:
        raise HTTPException(status_code=400, detail="Person already exists")


@app.post("/people/{person}/items/{item_id}/complete")
def toggle_item_completion(
    person: str, item_id: int, completed: Optional[bool] = Body(None, embed=True)
):
    return _toggle_item_completion(person, completed, identifier_key="id", identifier_value=item_id)


@app.post("/people/{person}/items-by-name/{item_name}/complete")
def toggle_item_completion_by_name(
    person: str, item_name: str, completed: Optional[bool] = Body(None, embed=True)
):
    return _toggle_item_completion(
        person, completed, identifier_key="name", identifier_value=item_name
    )


@app.post("/people/{person}/items")
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

    link_value: Optional[str] = None
    if item_link:
        stripped = item_link.strip()
        link_value = stripped if stripped else None

    image_value: Optional[str] = None
    if item_image:
        stripped_image = item_image.strip()
        image_value = stripped_image if stripped_image else None

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


@app.delete("/people/{person}/items/{item_id}")
def delete_item(person: str, item_id: int):
    return _delete_item(person, identifier_key="id", identifier_value=item_id)


@app.delete("/people/{person}/items-by-name/{item_name}")
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
