import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { ModelType, modelConfigs } from "../ai-config";
import { BufferMemory } from "langchain/memory";

interface ChatMessage {
  role: string;
  content: string;
}

export class LangChainService {
  private models: Map<string, ChatOpenAI | ChatGroq>;
  private memories: Map<string, BufferMemory>;

  constructor() {
    this.models = new Map();
    this.memories = new Map();
  }

  private getModel(modelType: ModelType) {
    if (this.models.has(modelType)) {
      return this.models.get(modelType)!;
    }

    const config = modelConfigs[modelType];
    let model;

    switch (config.provider) {
      case "openai":
        model = new ChatOpenAI({
          modelName: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          streaming: true,
        });
        break;
      case "groq":
        model = new ChatGroq({
          modelName: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          streaming: true,
        });
        break;
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }

    this.models.set(modelType, model);
    return model;
  }

  private getMemory(sessionId: string) {
    console.log(`[Memory] Getting memory for session ${sessionId}`);
    console.log(`[Memory] Existing memories: ${Array.from(this.memories.keys()).join(', ')}`);
    
    if (!this.memories.has(sessionId)) {
      console.log(`[Memory] Creating new memory for session ${sessionId}`);
      this.memories.set(sessionId, new BufferMemory({
        returnMessages: true,
        memoryKey: "chat_history",
        inputKey: "input",
        outputKey: "output",
      }));
    } else {
      console.log(`[Memory] Found existing memory for session ${sessionId}`);
    }
    return this.memories.get(sessionId)!;
  }

  private formatMessages(messages: ChatMessage[], systemPrompt?: string) {
    const formattedMessages = [];

    // Add system message if provided
    if (systemPrompt) {
      formattedMessages.push(new SystemMessage({ content: systemPrompt }));
    }

    // Format the rest of the messages
    messages.forEach((msg) => {
      if (msg.role === "user") {
        formattedMessages.push(new HumanMessage({ content: msg.content }));
      } else if (msg.role === "assistant") {
        formattedMessages.push(new AIMessage({ content: msg.content }));
      } else if (msg.role === "system" && !systemPrompt) {
        formattedMessages.push(new SystemMessage({ content: msg.content }));
      }
    });

    console.log(`[Memory] Formatted ${messages.length} messages`);
    return formattedMessages;
  }

  private async combineWithMemory(formattedMessages: BaseMessage[], memory: BufferMemory) {
    console.log(`[Memory] Loading memory variables`);
    const history = await memory.loadMemoryVariables({});
    console.log(`[Memory] Loaded history:`, history);
    const chatHistory = history.chat_history || [];
    console.log(`[Memory] Chat history length: ${chatHistory.length}`);
    console.log(`[Memory] Current messages length: ${formattedMessages.length}`);
    
    const combined = [...chatHistory, ...formattedMessages];
    console.log(`[Memory] Combined messages length: ${combined.length}`);
    return combined;
  }

  async *streamChat(params: {
    messages: ChatMessage[];
    model: ModelType;
    systemPrompt?: string;
    sessionId?: string;
  }) {
    const { messages, model, systemPrompt, sessionId } = params;
    console.log(`[Memory] Stream chat started for session ${sessionId}`);
    console.log(`[Memory] Received ${messages.length} messages`);
    
    const llm = this.getModel(model);
    const formattedMessages = this.formatMessages(messages, systemPrompt);
    let finalMessages = formattedMessages;

    if (sessionId) {
      console.log(`[Memory] Processing with memory for session ${sessionId}`);
      const memory = this.getMemory(sessionId);
      finalMessages = await this.combineWithMemory(formattedMessages, memory);
    }

    const chain = RunnableSequence.from([
      llm,
      new StringOutputParser(),
    ]);

    const stream = await chain.stream(finalMessages);

    if (sessionId) {
      const memory = this.getMemory(sessionId);
      const lastUserMessage = messages[messages.length - 1];
      let response = '';
      
      for await (const chunk of stream) {
        response += chunk;
        yield chunk;
      }

      console.log(`[Memory] Saving context for session ${sessionId}`);
      console.log(`[Memory] Input: ${lastUserMessage.content}`);
      console.log(`[Memory] Output: ${response}`);
      
      await memory.saveContext(
        { input: lastUserMessage.content },
        { output: response }
      );
      console.log(`[Memory] Context saved successfully`);
    } else {
      for await (const chunk of stream) {
        yield chunk;
      }
    }
  }

  async sendMessage(params: {
    messages: ChatMessage[];
    model: ModelType;
    systemPrompt?: string;
    sessionId?: string;
  }) {
    const { messages, model, systemPrompt, sessionId } = params;
    console.log(`[Memory] Send message started for session ${sessionId}`);
    console.log(`[Memory] Received ${messages.length} messages`);
    
    const llm = this.getModel(model);
    const formattedMessages = this.formatMessages(messages, systemPrompt);
    let finalMessages = formattedMessages;

    if (sessionId) {
      console.log(`[Memory] Processing with memory for session ${sessionId}`);
      const memory = this.getMemory(sessionId);
      finalMessages = await this.combineWithMemory(formattedMessages, memory);
    }

    const chain = RunnableSequence.from([
      llm,
      new StringOutputParser(),
    ]);

    const response = await chain.invoke(finalMessages);

    if (sessionId) {
      const memory = this.getMemory(sessionId);
      const lastUserMessage = messages[messages.length - 1];
      
      console.log(`[Memory] Saving context for session ${sessionId}`);
      console.log(`[Memory] Input: ${lastUserMessage.content}`);
      console.log(`[Memory] Output: ${response}`);
      
      await memory.saveContext(
        { input: lastUserMessage.content },
        { output: response }
      );
      console.log(`[Memory] Context saved successfully`);
    }

    return response;
  }
} 