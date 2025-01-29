from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import registry
from sqlalchemy import MetaData

# Create a metadata object without schema name
metadata = MetaData()

# Create the SQLAlchemy declarative base
Base = declarative_base(metadata=metadata)

# Create the registry
mapper_registry = registry()

# Note: Do not import models here to avoid circular imports
# Models should import Base from this module instead 