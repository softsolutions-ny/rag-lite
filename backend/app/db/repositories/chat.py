from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, select, func
from typing import List, Optional, Dict, Any, Union
import uuid
from datetime import datetime
from app.db.models.chat import ChatThread, ChatMessage

class ChatRepository:
    def __init__(self, db: Union[Session, AsyncSession]):
        self.db = db
        self.is_async = isinstance(db, AsyncSession)

    async def _get_next_thread_number(self, user_id: str) -> int:
        """Get the next thread number for untitled threads"""
        if self.is_async:
            # Query to find the highest number in existing "Untitled X" titles
            stmt = select(ChatThread).filter(
                ChatThread.user_id == user_id,
                ChatThread.title.like("Untitled %")
            )
            result = await self.db.execute(stmt)
            threads = result.scalars().all()
        else:
            threads = (self.db.query(ChatThread)
                      .filter(ChatThread.user_id == user_id,
                             ChatThread.title.like("Untitled %"))
                      .all())

        max_num = 0
        for thread in threads:
            try:
                num = int(thread.title.split(" ")[1])
                max_num = max(max_num, num)
            except (IndexError, ValueError):
                continue

        return max_num + 1

    async def create_thread(self, user_id: str, title: Optional[str] = None) -> ChatThread:
        """Create a new chat thread"""
        now = datetime.utcnow()
        
        # Generate incremental title if none provided
        if not title:
            next_num = await self._get_next_thread_number(user_id)
            title = f"Untitled {next_num}"
        
        thread = ChatThread(
            user_id=user_id,
            title=title,
            created_at=now,
            updated_at=now
        )
        self.db.add(thread)
        if self.is_async:
            await self.db.commit()
            await self.db.refresh(thread)
        else:
            self.db.commit()
            self.db.refresh(thread)
        return thread

    async def get_thread(self, thread_id: uuid.UUID) -> Optional[ChatThread]:
        """Get a chat thread by ID"""
        if self.is_async:
            stmt = select(ChatThread).filter_by(id=thread_id)
            result = await self.db.execute(stmt)
            thread = result.scalar_one_or_none()
        else:
            thread = self.db.query(ChatThread).filter_by(id=thread_id).first()
        
        if thread and thread.updated_at is None:
            thread.updated_at = thread.created_at
            if self.is_async:
                await self.db.commit()
            else:
                self.db.commit()
        
        return thread

    async def get_user_threads(self, user_id: str) -> List[ChatThread]:
        """Get all chat threads for a user, ordered by most recent"""
        if self.is_async:
            stmt = select(ChatThread).filter_by(user_id=user_id).order_by(desc(ChatThread.updated_at))
            result = await self.db.execute(stmt)
            threads = list(result.scalars().all())
        else:
            threads = (self.db.query(ChatThread)
                    .filter_by(user_id=user_id)
                    .order_by(desc(ChatThread.updated_at))
                    .all())
        
        # Ensure updated_at is set for all threads
        for thread in threads:
            if thread.updated_at is None:
                thread.updated_at = thread.created_at
                if self.is_async:
                    await self.db.commit()
                else:
                    self.db.commit()
        
        return threads

    async def add_message(
        self,
        thread_id: uuid.UUID,
        role: str,
        content: str,
        model: Optional[str] = None,
        image_url: Optional[str] = None
    ) -> ChatMessage:
        """Add a new message to a thread."""
        try:
            now = datetime.utcnow()
            db_message = ChatMessage(
                thread_id=thread_id,
                role=role,
                content=content,
                model=model,
                image_url=image_url,
                created_at=now
            )
            self.db.add(db_message)
            
            if self.is_async:
                await self.db.commit()
                await self.db.refresh(db_message)
            else:
                self.db.commit()
                self.db.refresh(db_message)
            return db_message
        except Exception as e:
            if self.is_async:
                await self.db.rollback()
            else:
                self.db.rollback()
            raise e

    async def get_thread_messages(self, thread_id: uuid.UUID) -> List[ChatMessage]:
        """Get all messages in a thread, ordered by creation time"""
        if self.is_async:
            stmt = select(ChatMessage).filter_by(thread_id=thread_id).order_by(ChatMessage.created_at)
            result = await self.db.execute(stmt)
            return list(result.scalars().all())
        else:
            return (self.db.query(ChatMessage)
                    .filter_by(thread_id=thread_id)
                    .order_by(ChatMessage.created_at)
                    .all())

    async def get_thread_with_messages(self, thread_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """Get a thread with all its messages"""
        thread = await self.get_thread(thread_id)
        if not thread:
            return None

        messages = await self.get_thread_messages(thread_id)
        return {
            **thread.to_dict(),
            "messages": [msg.to_dict() for msg in messages]
        }

    async def delete_thread(self, thread_id: uuid.UUID) -> bool:
        """Delete a chat thread and all its messages"""
        try:
            thread = await self.get_thread(thread_id)
            if not thread:
                return False
            
            # Delete all messages first
            if self.is_async:
                stmt = select(ChatMessage).filter_by(thread_id=thread_id)
                result = await self.db.execute(stmt)
                messages = result.scalars().all()
                for message in messages:
                    await self.db.delete(message)
            else:
                messages = self.db.query(ChatMessage).filter_by(thread_id=thread_id).all()
                for message in messages:
                    self.db.delete(message)
            
            # Then delete the thread
            if self.is_async:
                await self.db.delete(thread)
                await self.db.commit()
            else:
                self.db.delete(thread)
                self.db.commit()
            
            return True
        except Exception as e:
            if self.is_async:
                await self.db.rollback()
            else:
                self.db.rollback()
            raise e 

    async def update_thread_title(self, thread_id: uuid.UUID, title: str) -> Optional[ChatThread]:
        """Update a chat thread's title"""
        try:
            thread = await self.get_thread(thread_id)
            if not thread:
                return None
            
            thread.title = title
            thread.updated_at = datetime.utcnow()
            
            if self.is_async:
                await self.db.commit()
                await self.db.refresh(thread)
            else:
                self.db.commit()
                self.db.refresh(thread)
            
            return thread
        except Exception as e:
            if self.is_async:
                await self.db.rollback()
            else:
                self.db.rollback()
            raise e 

    async def update_thread(self, thread_id: uuid.UUID, data: Dict[str, Any]) -> Optional[ChatThread]:
        """Update a chat thread with the provided data"""
        try:
            thread = await self.get_thread(thread_id)
            if not thread:
                return None
            
            # Update fields from data
            for key, value in data.items():
                if hasattr(thread, key):
                    setattr(thread, key, value)
            
            # Always update the timestamp
            thread.updated_at = datetime.utcnow()
            
            if self.is_async:
                await self.db.commit()
                await self.db.refresh(thread)
            else:
                self.db.commit()
                self.db.refresh(thread)
            
            return thread
        except Exception as e:
            if self.is_async:
                await self.db.rollback()
            else:
                self.db.rollback()
            raise e 