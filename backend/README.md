# Elucide Backend

A FastAPI-based backend service for image analysis using OpenAI's Vision API.

## Project Structure

```
backend/
├── app/
│   ├── api/                 # API routes and endpoints
│   │   └── v1/
│   │       ├── endpoints/   # API endpoint handlers
│   │       └── router.py    # API router configuration
│   ├── core/               # Core application components
│   │   ├── config.py       # Configuration settings
│   │   ├── security.py     # Authentication/authorization
│   │   ├── logging.py      # Logging configuration
│   │   └── celery_app.py   # Celery configuration
│   ├── db/                 # Database related code
│   │   ├── base.py        # Base DB setup
│   │   ├── models/        # SQLAlchemy models
│   │   └── repositories/  # Database access layers
│   ├── schemas/           # Pydantic models
│   ├── services/          # Business logic
│   └── utils/             # Utility functions
├── alembic/               # Database migrations
├── tests/                 # Test files
├── logs/                  # Log files
├── uploads/              # Media files
├── credentials/          # Sensitive credentials
└── requirements/         # Dependencies
```

## Setup

1. Create a virtual environment:

   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Linux/macOS
   .venv\Scripts\activate     # Windows
   ```

2. Install dependencies:

   ```bash
   # For development
   pip install -r requirements/dev.txt

   # For production
   pip install -r requirements/prod.txt
   ```

3. Set up environment variables in `.env`:

   ```
   POSTGRES_USER=your_user
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=your_db
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432

   REDIS_URL=redis://localhost:6379/0

   OPENAI_API_KEY=your_openai_key

   CLERK_ISSUER=your_clerk_issuer

   CORS_ORIGINS=http://localhost:3000
   ```

4. Initialize the database:

   ```bash
   alembic upgrade head
   ```

5. Run the development server:

   ```bash
   uvicorn app.main:app --reload
   ```

6. Start Celery worker:
   ```bash
   celery -A app.core.celery_app:celery_app worker --loglevel=info
   ```

## API Documentation

Once the server is running, you can access:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Development

- Run tests: `pytest`
- Format code: `black .`
- Sort imports: `isort .`
- Check types: `mypy .`
- Lint code: `flake8`

## Database Migrations

Create a new migration:

```bash
alembic revision --autogenerate -m "description"
```

Apply migrations:

```bash
alembic upgrade head
```

Revert migrations:

```bash
alembic downgrade -1  # Revert last migration
alembic downgrade base  # Revert all migrations
```
