from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import os

app = FastAPI()

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize SQLite database
def init_db():
    conn = sqlite3.connect("wishlist.db")
    c = conn.cursor()

    # Create tables if they don't exist
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS people (
            name TEXT PRIMARY KEY,
            color TEXT NOT NULL
        )
    """
    )
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            person_name TEXT NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY (person_name) REFERENCES people (name) ON DELETE CASCADE,
            UNIQUE(person_name, name)
        )
    """
    )

    # Check if completed column exists
    c.execute("PRAGMA table_info(items)")
    columns = [column[1] for column in c.fetchall()]
    if "completed" not in columns:
        # Add completed column if it doesn't exist
        c.execute("ALTER TABLE items ADD COLUMN completed BOOLEAN DEFAULT FALSE")

    conn.commit()
    conn.close()


init_db()


@app.get("/people")
def list_people():
    conn = sqlite3.connect("wishlist.db")
    c = conn.cursor()
    result = {}

    # Get all people and their colors
    c.execute("SELECT name, color FROM people")
    people = c.fetchall()

    if not people:
        # Return empty object if no people exist
        return {}

    # Get all items for each person
    for person_name, color in people:
        c.execute(
            "SELECT name, completed FROM items WHERE person_name = ? COLLATE NOCASE",
            (person_name,),
        )
        items = [{"name": item[0], "completed": bool(item[1])} for item in c.fetchall()]
        result[person_name] = {"items": items, "color": color}

    conn.close()
    return result


@app.post("/people")
def add_person(name: str = Form(...), color: str = Form(...)):
    conn = sqlite3.connect("wishlist.db")
    c = conn.cursor()
    try:
        c.execute("INSERT INTO people (name, color) VALUES (?, ?)", (name, color))
        conn.commit()
        return {"message": f"Person '{name}' added"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Person already exists")
    finally:
        conn.close()


@app.post("/people/{person}/items/{item_name}/complete")
def toggle_item_completion(person: str, item_name: str):
    conn = sqlite3.connect("wishlist.db")
    c = conn.cursor()
    try:
        # Check if person and item exist
        c.execute(
            "SELECT completed FROM items WHERE person_name = ? AND name = ?",
            (person, item_name),
        )
        result = c.fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Item not found")

        # Toggle the completed status
        current_status = bool(result[0])
        new_status = not current_status

        c.execute(
            "UPDATE items SET completed = ? WHERE person_name = ? AND name = ?",
            (new_status, person, item_name),
        )
        conn.commit()
        return {"message": "Item completion status updated"}
    finally:
        conn.close()


@app.post("/people/{person}/items")
def add_item(person: str, item_name: str = Form(...)):
    conn = sqlite3.connect("wishlist.db")
    c = conn.cursor()
    try:
        c.execute("SELECT name FROM people WHERE name = ?", (person,))
        if not c.fetchone():
            raise HTTPException(status_code=404, detail="Person not found")

        c.execute(
            "INSERT INTO items (person_name, name) VALUES (?, ?)", (person, item_name)
        )
        conn.commit()
        return {"message": "Item added"}
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=400, detail="Item already exists for this person"
        )
    finally:
        conn.close()


@app.delete("/people/{person}/items/{item_name}")
def delete_item(person: str, item_name: str):
    conn = sqlite3.connect("wishlist.db")
    c = conn.cursor()
    try:
        c.execute("SELECT name FROM people WHERE name = ?", (person,))
        if not c.fetchone():
            raise HTTPException(status_code=404, detail="Person not found")

        c.execute(
            "DELETE FROM items WHERE person_name = ? AND name = ?", (person, item_name)
        )
        conn.commit()
        if c.rowcount == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"message": "Item deleted"}
    finally:
        conn.close()
