from fastapi import FastAPI, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

people = {}  # { person: [ {name, image_filename}, ... ] }


@app.get("/people")
def list_people():
    return people


@app.post("/people")
def add_person(name: str = Form(...)):
    if name in people:
        return {"error": "Person already exists"}
    people[name] = []
    return {"message": f"Person '{name}' added"}


@app.post("/people/{person}/items")
async def add_item(
    person: str, item_name: str = Form(...), image: UploadFile = File(None)
):
    if person not in people:
        return {"error": "Person not found"}
    image_name = image.filename if image else None
    people[person].append({"name": item_name, "image": image_name})
    return {"message": "Item added"}


@app.delete("/people/{person}/items/{item_name}")
def delete_item(person: str, item_name: str):
    if person not in people:
        return {"error": "Person not found"}
    people[person] = [i for i in people[person] if i["name"] != item_name]
    return {"message": "Item deleted"}
