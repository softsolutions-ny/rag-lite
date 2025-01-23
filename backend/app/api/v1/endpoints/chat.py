from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional, List
import logging
from sqlalchemy import select, update
from datetime import datetime

from app.db.session import get_db
from app.db.repositories.chat import ChatRepository
from app.db.models.chat import ChatThread as DBChatThread, ChatMessage as DBChatMessage, ChatFolder as DBChatFolder
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessage,
    ChatThreadCreate,
    ChatThread,
    ChatThreadUpdate,
    ChatThreadWithMessages
)
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()

class ThreadCreate(BaseModel):
    user_id: str
    title: Optional[str] = None
    label: Optional[str] = None

    class Config:
        from_attributes = True

class ThreadUpdate(BaseModel):
    title: Optional[str] = None
    label: Optional[str] = None
    folder_id: Optional[UUID] = None

    class Config:
        from_attributes = True

class ThreadResponse(BaseModel):
    id: UUID
    user_id: str
    title: Optional[str]
    label: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

class FolderCreate(BaseModel):
    user_id: str
    name: str
    parent_id: Optional[UUID] = None

    class Config:
        from_attributes = True

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[UUID] = None

    class Config:
        from_attributes = True

class FolderResponse(BaseModel):
    id: UUID
    user_id: str
    name: str
    parent_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

@router.post("/threads", response_model=ThreadResponse)
async def create_chat_thread(
    thread: ThreadCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new chat thread."""
    try:
        chat_repo = ChatRepository(db)
        db_thread = await chat_repo.create_thread(thread.user_id, thread.title)
        return ThreadResponse.from_orm(db_thread)
    except Exception as e:
        logger.error(f"Error creating thread: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/threads", response_model=List[ThreadResponse])
async def get_chat_threads(
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all chat threads for a user."""
    try:
        chat_repo = ChatRepository(db)
        threads = await chat_repo.get_user_threads(user_id)
        return [ThreadResponse.from_orm(thread) for thread in threads]
    except Exception as e:
        logger.error(f"Error fetching threads: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/threads/{thread_id}", response_model=ChatThreadWithMessages)
async def get_chat_thread(
    thread_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific chat thread with its messages."""
    try:
        chat_repo = ChatRepository(db)
        thread = await chat_repo.get_thread(thread_id)
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")
        messages = await chat_repo.get_thread_messages(thread_id)
        return ChatThreadWithMessages(
            **thread.__dict__,
            messages=messages
        )
    except Exception as e:
        logger.error(f"Error fetching thread: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/threads/{thread_id}", response_model=ThreadResponse)
async def update_chat_thread(
    thread_id: UUID,
    thread_update: ThreadUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a chat thread."""
    try:
        chat_repo = ChatRepository(db)
        updated_thread = await chat_repo.update_thread(thread_id, thread_update.dict())
        if not updated_thread:
            raise HTTPException(status_code=404, detail="Thread not found")
        return ThreadResponse.from_orm(updated_thread)
    except Exception as e:
        logger.error(f"Error updating thread: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/threads/{thread_id}")
async def delete_chat_thread(
    thread_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete a chat thread."""
    try:
        chat_repo = ChatRepository(db)
        await chat_repo.delete_thread(thread_id)
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error deleting thread: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/messages", response_model=ChatMessage)
async def create_chat_message(
    message: ChatMessageCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new chat message."""
    try:
        chat_repo = ChatRepository(db)
        thread = await chat_repo.get_thread(UUID(message.thread_id))
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")
        
        # Store the message
        db_message = await chat_repo.add_message(
            thread_id=UUID(message.thread_id),
            role=message.role,
            content=message.content,
            model=message.model
        )
        
        # Update thread's timestamp while preserving all other fields
        await chat_repo.update_thread(
            UUID(message.thread_id),
            {
                "title": thread.title,  # Explicitly preserve the title
                "updated_at": datetime.utcnow()
            }
        )
        
        return ChatMessage.from_orm(db_message)
    except Exception as e:
        logger.error(f"Error creating message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/threads/{thread_id}/messages", response_model=List[ChatMessage])
async def get_thread_messages(
    thread_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get all messages in a thread."""
    try:
        chat_repo = ChatRepository(db)
        messages = await chat_repo.get_thread_messages(thread_id)
        return [ChatMessage.from_orm(message) for message in messages]
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/folders", response_model=FolderResponse)
async def create_folder(folder: FolderCreate, db: AsyncSession = Depends(get_db)):
    """Create a new folder"""
    logger.info(f"Creating folder for user {folder.user_id}")
    try:
        # If parent_id is provided, verify it exists
        if folder.parent_id:
            parent_folder = await db.get(DBChatFolder, folder.parent_id)
            if not parent_folder:
                raise HTTPException(status_code=404, detail="Parent folder not found")
            if parent_folder.user_id != folder.user_id:
                raise HTTPException(status_code=403, detail="Parent folder belongs to different user")

        db_folder = DBChatFolder(
            user_id=folder.user_id,
            name=folder.name,
            parent_id=folder.parent_id
        )
        db.add(db_folder)
        await db.commit()
        await db.refresh(db_folder)
        return FolderResponse.from_orm(db_folder)
    except Exception as e:
        logger.error(f"Error creating folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/folders", response_model=List[FolderResponse])
async def get_folders(user_id: str, db: AsyncSession = Depends(get_db)):
    """Get all folders for a user"""
    logger.info(f"Fetching folders for user: {user_id}")
    try:
        result = await db.execute(
            select(DBChatFolder).where(DBChatFolder.user_id == user_id)
        )
        folders = result.scalars().all()
        return [FolderResponse.from_orm(folder) for folder in folders]
    except Exception as e:
        logger.error(f"Error fetching folders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/folders/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: UUID,
    folder_update: FolderUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a folder"""
    logger.info(f"Updating folder {folder_id}")
    try:
        folder = await db.get(DBChatFolder, folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

        if folder_update.name is not None:
            folder.name = folder_update.name
        if folder_update.parent_id is not None:
            # Verify parent exists and prevent circular references
            if folder_update.parent_id == folder_id:
                raise HTTPException(status_code=400, detail="Folder cannot be its own parent")
            parent = await db.get(DBChatFolder, folder_update.parent_id)
            if not parent:
                raise HTTPException(status_code=404, detail="Parent folder not found")
            folder.parent_id = folder_update.parent_id

        await db.commit()
        await db.refresh(folder)
        return FolderResponse.from_orm(folder)
    except Exception as e:
        logger.error(f"Error updating folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/folders/{folder_id}", status_code=204)
async def delete_folder(folder_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a folder and optionally move its contents"""
    logger.info(f"Deleting folder {folder_id}")
    try:
        folder = await db.get(DBChatFolder, folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

        # Update threads to remove folder reference
        await db.execute(
            update(DBChatThread)
            .where(DBChatThread.folder_id == folder_id)
            .values(folder_id=None)
        )

        # Delete the folder
        await db.delete(folder)
        await db.commit()
    except Exception as e:
        logger.error(f"Error deleting folder: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 