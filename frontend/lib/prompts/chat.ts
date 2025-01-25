export const CHAT_SYSTEM_PROMPT = `You are a helpful AI assistant focused on providing clear, accurate, and relevant responses.
You excel at understanding context and maintaining coherent conversations.`;

export const IMAGE_ANALYSIS_PROMPT = (imageDescription: string) => 
  `The image depicts ${imageDescription}\n\nAssistant: What else would you like to know about this image?`; 