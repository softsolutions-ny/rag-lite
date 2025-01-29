from logging.config import fileConfig
from sqlalchemy import engine_from_config, create_engine
from sqlalchemy import pool, schema, text
from alembic import context
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import the SQLAlchemy models
from app.db.models import Base
from app.core.config import settings

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

def include_object(object, name, type_, reflected, compare_to):
    """Determine which database objects should be included in the autogenerate process."""
    # Only include objects in our target schema
    if type_ == "table":
        return object.schema == "elucide" if object.schema else True
    return True

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = settings.DATABASE_URL_SYNC
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named",
        },
        include_schemas=True,
        include_object=include_object,
        version_table_schema="elucide",
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Create the engine directly with our settings
    connectable = create_engine(
        settings.DATABASE_URL_SYNC,
        poolclass=pool.NullPool,
        connect_args={"options": "-c search_path=elucide,public"}
    )

    with connectable.connect() as connection:
        # Ensure the schema exists
        connection.execute(schema.CreateSchema("elucide", if_not_exists=True))
        
        # Set the search path for this connection
        connection.execute(text("SET search_path TO elucide, public"))
        
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
            include_object=include_object,
            version_table_schema="elucide",
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online() 