from sqlalchemy import create_engine
from models import Base
import os
from dotenv import load_dotenv

load_dotenv()

def init_db():
    # Create database URL
    DATABASE_URL = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Create all tables
    Base.metadata.create_all(engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_db()