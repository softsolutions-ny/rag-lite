from sqlalchemy import create_engine, text
import os

def verify_connection():
    # Get the environment
    env = os.getenv("ENV", "development")
    print(f"\nCurrent environment: {env}")
    
    # Get database URL based on environment
    if env == "production":
        db_url = os.getenv("SUPABASE_DATABASE_URL")
        if not db_url:
            print("Error: SUPABASE_DATABASE_URL environment variable is not set")
            print("Please ensure you have set SUPABASE_DATABASE_URL in your environment or .env.production file")
            return False
        print("Using Supabase database URL")
        
        # Mask sensitive information for logging
        masked_url = db_url.replace("://", "://****:****@")
        print(f"Database URL: {masked_url}")
        
        # Add SSL configuration for production
        engine = create_engine(db_url, connect_args={
            "sslmode": "require",
            "options": "-c search_path=elucide,public"
        })
    else:
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            print("Error: DATABASE_URL environment variable is not set")
            print("Please ensure you have set DATABASE_URL in your environment or .env file")
            return False
        print("Using development database URL")
        engine = create_engine(db_url, connect_args={
            "options": "-c search_path=elucide,public"
        })
    
    try:
        # Try to connect and list tables
        with engine.connect() as conn:
            # Test basic connection
            print("\nTesting connection...")
            result = conn.execute(text("SELECT 1")).scalar()
            print("✓ Basic connection test successful!")
            
            # Check current schema
            print("\nChecking schema configuration...")
            result = conn.execute(text("SHOW search_path"))
            print(f"✓ Current search_path: {result.scalar()}")
            
            # List tables in the elucide schema
            print("\nQuerying schema information...")
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'elucide'
            """))
            tables = [row[0] for row in result]
            
            if tables:
                print("✓ Successfully found tables in elucide schema:")
                for table in tables:
                    print(f"  - {table}")
            else:
                print("! No tables found in elucide schema")
            
            # Get row counts for each table
            if tables:
                print("\nRow counts:")
                for table in tables:
                    try:
                        count = conn.execute(text(f'SELECT COUNT(*) FROM "elucide"."{table}"')).scalar()
                        print(f"  - {table}: {count} rows")
                    except Exception as e:
                        print(f"  - {table}: Error - {str(e)}")
            
            print("\n✓ Database connection verification completed successfully!")
            return True
                
    except Exception as e:
        print(f"\n✗ Error connecting to database: {str(e)}")
        print("\nTroubleshooting tips:")
        print("1. Check if the database URL is correct")
        print("2. Ensure the database is accessible from your current location")
        print("3. Verify that the database user has the necessary permissions")
        print("4. Check if SSL is properly configured (required for production)")
        return False

if __name__ == "__main__":
    success = verify_connection()
    if not success:
        exit(1) 