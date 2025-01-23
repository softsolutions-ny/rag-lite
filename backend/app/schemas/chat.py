from pydantic import BaseModel, UUID4
from datetime import datetime
from typing import Optional, List
from uuid import UUID

class ChatMessageBase(BaseModel):
    role: str
    content: str
    model: Optional[str] = None

class ChatMessageCreate(BaseModel):
    thread_id: str
    role: str
    content: str
    model: Optional[str] = None

class ChatMessage(ChatMessageBase):
    id: UUID4
    thread_id: UUID4
    created_at: datetime

    class Config:
        from_attributes = True

class ChatThreadBase(BaseModel):
    user_id: str
    title: Optional[str] = None

class ChatThreadCreate(ChatThreadBase):
    pass

class ChatThreadUpdate(BaseModel):
    title: str

class ChatThread(ChatThreadBase):
    id: UUID
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ChatThreadWithMessages(ChatThread):
    messages: List[ChatMessage]

    class Config:
        from_attributes = True 