from sqlalchemy import create_engine, text
from app.core.config import settings
import os

def verify_connection():
    # Get the environment
    env = os.getenv("ENV", "development")
    print(f"Current environment: {env}")
    
    # Create engine with the appropriate DATABASE_URL
    if env == "production":
        db_url = os.getenv("DATABASE_URL")
        print("Using production database URL")
    else:
        db_url = settings.DATABASE_URL_SYNC
        print("Using development database URL")
        
    engine = create_engine(db_url)
    
    try:
        # Try to connect and list tables
        with engine.connect() as conn:
            result = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
            tables = [row[0] for row in result]
            print("Successfully connected to the database!")
            print("\nAvailable tables:")
            for table in tables:
                print(f"- {table}")
            
            # Get row counts for each table
            print("\nRow counts:")
            for table in tables:
                count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                print(f"- {table}: {count} rows")
                
    except Exception as e:
        print(f"Error connecting to database: {str(e)}")

if __name__ == "__main__":
    verify_connection() 