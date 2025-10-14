from fastapi import Form, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from main import app, engine


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
                    SELECT name, completed
                    FROM items
                    WHERE LOWER(person_name) = LOWER(:person_name)
                """
                ),
                {"person_name": person_name},
            ).fetchall()
            result[person_name] = {
                "items": [{"name": item[0], "completed": bool(item[1])} for item in items],
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


@app.post("/people/{person}/items/{item_name}/complete")
def toggle_item_completion(person: str, item_name: str):
    with engine.begin() as conn:
        result = conn.execute(
            text(
                """
                SELECT completed
                FROM items
                WHERE LOWER(person_name) = LOWER(:person) AND name = :item_name
            """
            ),
            {"person": person, "item_name": item_name},
        )
        row = result.first()
        if not row:
            raise HTTPException(status_code=404, detail="Item not found")

        current_status = bool(row[0])
        new_status = not current_status

        conn.execute(
            text(
                """
                UPDATE items
                SET completed = :new_status
                WHERE LOWER(person_name) = LOWER(:person) AND name = :item_name
            """
            ),
            {"new_status": new_status, "person": person, "item_name": item_name},
        )
    return {"message": "Item completion status updated"}


@app.post("/people/{person}/items")
def add_item(person: str, item_name: str = Form(...)):
    with engine.connect() as conn:
        person_exists = conn.execute(
            text("SELECT 1 FROM people WHERE LOWER(name) = LOWER(:person)"),
            {"person": person},
        ).first()

    if not person_exists:
        raise HTTPException(status_code=404, detail="Person not found")

    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO items (person_name, name)
                    VALUES (
                        (SELECT name FROM people WHERE LOWER(name) = LOWER(:person)),
                        :item_name
                    )
                """
                ),
                {"person": person, "item_name": item_name},
            )
        return {"message": "Item added"}
    except IntegrityError:
        raise HTTPException(
            status_code=400, detail="Item already exists for this person"
        )


@app.delete("/people/{person}/items/{item_name}")
def delete_item(person: str, item_name: str):
    with engine.connect() as conn:
        person_exists = conn.execute(
            text("SELECT 1 FROM people WHERE LOWER(name) = LOWER(:person)"),
            {"person": person},
        ).first()

    if not person_exists:
        raise HTTPException(status_code=404, detail="Person not found")

    with engine.begin() as conn:
        result = conn.execute(
            text(
                """
                DELETE FROM items
                WHERE LOWER(person_name) = LOWER(:person) AND name = :item_name
                RETURNING id
            """
            ),
            {"person": person, "item_name": item_name},
        ).first()

        if not result:
            raise HTTPException(status_code=404, detail="Item not found")

    return {"message": "Item deleted"}
