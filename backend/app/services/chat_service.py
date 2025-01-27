from fastapi import HTTPException
from typing import AsyncGenerator, Dict, Any
import logging
from app.core.config import settings

from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

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

    async def stream_chat(
        self,
        messages: list[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat completions using LangChain
        """
        try:
            llm = self._get_model(model)
            formatted_messages = self._format_messages(messages)

            # Create a simple chain that just passes through the messages to the LLM
            chain = llm | StrOutputParser()

            async for chunk in chain.astream(formatted_messages):
                yield chunk

        except Exception as e:
            logger.error(f"Error in stream_chat: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    def get_available_models(self) -> Dict[str, Any]:
        """
        Get list of available models
        """
        return self.available_models 