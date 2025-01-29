from sqlalchemy import create_engine, text
from app.core.config import settings
import os

def verify_connection():
    # Get the environment
    env = os.getenv("ENV", "development")
    print(f"Current environment: {env}")
    
    # Create engine with the appropriate DATABASE_URL
    if env == "production":
        db_url = os.getenv("SUPABASE_DATABASE_URL")
        print("Using Supabase database URL")
    else:
        db_url = settings.DATABASE_URL_SYNC
        print("Using development database URL")
        
    engine = create_engine(db_url)
    
    try:
        # Try to connect and list tables
        with engine.connect() as conn:
            # List tables in the elucide schema
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'elucide'
            """))
            tables = [row[0] for row in result]
            print("Successfully connected to the database!")
            print("\nAvailable tables in elucide schema:")
            for table in tables:
                print(f"- {table}")
            
            # Get row counts for each table
            print("\nRow counts:")
            for table in tables:
                try:
                    count = conn.execute(text(f'SELECT COUNT(*) FROM "elucide"."{table}"')).scalar()
                    print(f"- {table}: {count} rows")
                except Exception as e:
                    print(f"- {table}: Error - {str(e)}")
                
    except Exception as e:
        print(f"Error connecting to database: {str(e)}")

def test_db_connection():
    try:
        # Get production database URL
        db_url = os.getenv('SUPABASE_DATABASE_URL')
        
        # Create engine
        engine = create_engine(db_url)
        
        with engine.connect() as connection:
            print("Successfully connected to the database!")
            
            # Check current schema
            result = connection.execute("SHOW search_path")
            print("Current schema:", result.fetchone()[0])
            
            # Get table names
            tables = connection.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'elucide'
            """).fetchall()
            
            print("\nAvailable tables:")
            for table in tables:
                print(f"- {table[0]}")
                
            # Get row counts (with proper table name quoting)
            print("\nRow counts:")
            for table in tables:
                try:
                    count = connection.execute(f'SELECT COUNT(*) FROM "{table[0]}"').scalar()
                    print(f"- {table[0]}: {count} rows")
                except Exception as e:
                    print(f"- {table[0]}: Error - {str(e)}")
                    
    except Exception as e:
        print(f"Error connecting to database: {e}")

if __name__ == "__main__":
    verify_connection() 