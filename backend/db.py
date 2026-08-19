"""
db.py

Sets up the connection to your Postgres database.
Other files import from here to actually talk to the database.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]

# The engine is the actual connection to Postgres.
engine = create_engine(DATABASE_URL)

# SessionLocal is a factory that creates a new "conversation" with the database
# each time you need one - you open one, do some work, then close it.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is what our table definitions (in models.py) will build on top of.
Base = declarative_base()


def get_db():
    """
    A reusable helper that opens a database session, hands it to whoever
    needs it, and makes sure it always gets closed afterward - even if
    something goes wrong in between.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()