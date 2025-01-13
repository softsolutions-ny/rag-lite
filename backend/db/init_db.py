from sqlalchemy import create_engine, inspect, text
from .models import Base, Image, ImageProcessing
import os
from dotenv import load_dotenv

load_dotenv()

def init_db():
    # Create database URL
    DATABASE_URL = f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
    
    # Create engine with echo to see SQL output
    engine = create_engine(DATABASE_URL, echo=True)
    
    # Drop old tables if they exist
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS processing_stats CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS job_stats CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS image_analyses CASCADE"))
        conn.commit()
        print("Dropped old tables.")
    
    # Drop all tables
    Base.metadata.drop_all(engine)
    print("Dropped all existing tables.")
    
    # Create all tables
    Base.metadata.create_all(engine)
    print("Database tables created successfully!")
    
    # Verify table structure
    inspector = inspect(engine)
    for table in ['images', 'image_processings']:
        print(f"\nColumns in {table}:")
        columns = inspector.get_columns(table)
        for column in columns:
            print(f"  - {column['name']}: {column['type']}")

if __name__ == "__main__":
    init_db()