from sqlalchemy import Column, String, Text, DateTime, ForeignKey, UUID, func
from sqlalchemy.orm import relationship
from app.db.base import Base
import uuid
from datetime import datetime

class ChatFolder(Base):
    __tablename__ = "chat_folders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("chat_folders.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    threads = relationship("ChatThread", back_populates="folder")
    parent = relationship("ChatFolder", remote_side=[id], backref="children")

    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": self.user_id,
            "name": self.name,
            "parent_id": str(self.parent_id) if self.parent_id else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

class ChatThread(Base):
    __tablename__ = "chat_threads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False)
    title = Column(String, nullable=True)
    label = Column(String, nullable=True)  # New column for thread labels
    folder_id = Column(UUID(as_uuid=True), ForeignKey("chat_folders.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    
    # Relationships
    messages = relationship("ChatMessage", back_populates="thread", cascade="all, delete-orphan")
    folder = relationship("ChatFolder", back_populates="threads")

    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": self.user_id,
            "title": self.title,
            "label": self.label,
            "folder_id": str(self.folder_id) if self.folder_id else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id = Column(UUID(as_uuid=True), ForeignKey("chat_threads.id"), nullable=False)
    role = Column(String, nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    model = Column(String)  # gpt-4o-mini, deepseek-reasoner
    image_url = Column(String, nullable=True)  # URL for message images
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    thread = relationship("ChatThread", back_populates="messages")

    def to_dict(self):
        return {
            "id": str(self.id),
            "thread_id": str(self.thread_id),
            "role": self.role,
            "content": self.content,
            "model": self.model,
            "image_url": self.image_url,
            "created_at": self.created_at.isoformat(),
        } 