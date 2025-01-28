from fastapi import HTTPException
from typing import AsyncGenerator, Dict, Any
import logging
from app.core.config import settings

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain.memory import ConversationBufferWindowMemory

logger = logging.getLogger(__name__)

class ChatService:
    def __init__(self):
        self.available_models = {
            "mixtral-8x7b-32768": {
                "name": "mixtral-8x7b-32768",
                "context_length": 32768,
                "streaming": True,
                "provider": "groq"
            },
            "llama-3.3-70b-versatile": {
                "name": "llama-3.3-70b-versatile",
                "context_length": 8192,
                "streaming": True,
                "provider": "groq"
            },
            "deepseek-r1-distill-llama-70b": {
                "name": "deepseek-r1-distill-llama-70b",
                "context_length": 8192,
                "streaming": True,
                "provider": "groq"
            },
            "gpt-4o": {
                "name": "gpt-4o",
                "context_length": 8192,
                "streaming": True,
                "provider": "openai"
            },
            "gpt-4o-mini": {
                "name": "gpt-4o-mini",
                "context_length": 4096,
                "streaming": True,
                "provider": "openai"
            },
            "agent-1": {
                "name": "gpt-4o",  # Uses GPT-4 under the hood
                "context_length": 8192,
                "streaming": True,
                "provider": "openai"
            }
        }
        self.models = {}
        self.memories = {}

    def _get_model(self, model_name: str):
        if model_name in self.models:
            return self.models[model_name]

        model_config = self.available_models.get(model_name)
        if not model_config:
            raise HTTPException(
                status_code=400,
                detail=f"Model {model_name} not supported. Available models: {list(self.available_models.keys())}"
            )

        if model_config["provider"] == "groq":
            model = ChatGroq(
                model_name=model_name,
                groq_api_key=settings.GROQ_API_KEY,
                streaming=True
            )
        elif model_config["provider"] == "openai":
            model = ChatOpenAI(
                model_name=model_config["name"],  # Use the actual model name
                openai_api_key=settings.OPENAI_API_KEY,
                streaming=True
            )
        elif model_config["provider"] == "deepseek":
            # TODO: Add DeepSeek integration
            raise HTTPException(
                status_code=400,
                detail="DeepSeek integration not yet implemented"
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Provider {model_config['provider']} not supported"
            )

        self.models[model_name] = model
        return model

    def _get_memory(self, thread_id: str):
        if thread_id not in self.memories:
            self.memories[thread_id] = ConversationBufferWindowMemory(
                return_messages=True,
                memory_key="chat_history",
                k=10,  # Keep last 10 messages
            )
        return self.memories[thread_id]

    def _format_messages(self, messages: list[Dict[str, str]]):
        formatted_messages = []
        for msg in messages:
            if msg["role"] == "user":
                formatted_messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                formatted_messages.append(AIMessage(content=msg["content"]))
            elif msg["role"] == "system":
                formatted_messages.append(SystemMessage(content=msg["content"]))
        return formatted_messages

    async def _combine_with_memory(self, formatted_messages: list, memory: ConversationBufferWindowMemory):
        # Get the last user message for memory input
        last_user_msg = next((msg for msg in reversed(formatted_messages) if isinstance(msg, HumanMessage)), None)
        if last_user_msg:
            # Load memory variables synchronously since the new version doesn't support async
            history = memory.load_memory_variables({"input": last_user_msg.content})
            chat_history = history.get("chat_history", [])
            return chat_history + formatted_messages
        return formatted_messages

    async def stream_chat(
        self,
        messages: list[Dict[str, str]],
        model: str,
        thread_id: str,
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat completions using LangChain with memory
        """
        try:
            logger.info(f"Starting chat stream for thread {thread_id}")
            llm = self._get_model(model)
            formatted_messages = self._format_messages(messages)
            memory = self._get_memory(thread_id)

            # Combine memory with current messages
            final_messages = await self._combine_with_memory(formatted_messages, memory)
            logger.info(f"Combined {len(final_messages)} messages for thread {thread_id}")

            # Create a simple chain that just passes through the messages to the LLM
            chain = llm | StrOutputParser()

            # Stream the response and accumulate it
            accumulated_response = ""
            last_user_msg = messages[-1]["content"] if messages else ""
            
            async for chunk in chain.astream(final_messages):
                accumulated_response += chunk
                yield chunk

            # Save to memory after completion
            memory.save_context(
                {"input": last_user_msg},
                {"output": accumulated_response}
            )
            logger.info(f"Saved context to memory for thread {thread_id}")

        except Exception as e:
            logger.error(f"Error in stream_chat: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    def get_available_models(self) -> Dict[str, Any]:
        """
        Get list of available models
        """
        return self.available_models 