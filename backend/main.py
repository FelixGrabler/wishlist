import os
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, SQLAlchemyError

app = FastAPI()

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Database configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg://wishlist:wishlist@db:5432/wishlist"
)
engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True)


# Initialize PostgreSQL database
def init_db():
    retries = int(os.getenv("DB_INIT_RETRIES", "10"))
    delay = float(os.getenv("DB_INIT_DELAY_SEC", "1"))

    for attempt in range(1, retries + 1):
        try:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS people (
                            name TEXT PRIMARY KEY,
                            color TEXT NOT NULL
                        )
                    """
                    )
                )
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS items (
                            id SERIAL PRIMARY KEY,
                            person_name TEXT NOT NULL,
                            name TEXT NOT NULL,
                            completed BOOLEAN DEFAULT FALSE,
                            url TEXT,
                            image TEXT,
                            FOREIGN KEY (person_name) REFERENCES people (name) ON DELETE CASCADE,
                            UNIQUE(person_name, name)
                        )
                    """
                    )
                )
                # Ensure deployments that already created the table receive the URL column
                conn.execute(
                    text(
                        """
                        ALTER TABLE items
                        ADD COLUMN IF NOT EXISTS url TEXT
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        ALTER TABLE items
                        ADD COLUMN IF NOT EXISTS image TEXT
                        """
                    )
                )
            break
        except (OperationalError, SQLAlchemyError) as exc:
            if attempt == retries:
                raise RuntimeError("Failed to initialize database") from exc
            time.sleep(delay)


init_db()

import routes
