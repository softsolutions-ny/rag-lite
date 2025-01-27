import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { ModelType, modelConfigs } from "../ai-config";

interface ChatMessage {
  role: string;
  content: string;
}

export class LangChainService {
  private models: Map<string, ChatOpenAI | ChatGroq>;

  constructor() {
    this.models = new Map();
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

    return formattedMessages;
  }

  async *streamChat(params: {
    messages: ChatMessage[];
    model: ModelType;
    systemPrompt?: string;
  }) {
    const { messages, model, systemPrompt } = params;
    const llm = this.getModel(model);
    const formattedMessages = this.formatMessages(messages, systemPrompt);

    const chain = RunnableSequence.from([
      llm,
      new StringOutputParser(),
    ]);

    const stream = await chain.stream(formattedMessages);

    for await (const chunk of stream) {
      yield chunk;
    }
  }

  async sendMessage(params: {
    messages: ChatMessage[];
    model: ModelType;
    systemPrompt?: string;
  }) {
    const { messages, model, systemPrompt } = params;
    const llm = this.getModel(model);
    const formattedMessages = this.formatMessages(messages, systemPrompt);

    const chain = RunnableSequence.from([
      llm,
      new StringOutputParser(),
    ]);

    return await chain.invoke(formattedMessages);
  }
} 