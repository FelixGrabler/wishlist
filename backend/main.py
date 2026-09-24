from contextlib import asynccontextmanager
from fastapi import FastAPI
from database import engine, init_db
from routes import router


@asynccontextmanager
async def lifespan(app):
    init_db()
    try:
        yield
    finally:
        engine.dispose()


app = FastAPI(lifespan=lifespan)
app.include_router(router)
