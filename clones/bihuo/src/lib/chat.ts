export const MAX_MESSAGE_CHARS = 4000;
export const MAX_HISTORY_MESSAGES = 13;
export const MAX_HISTORY_CHARS = 16000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatReply {
  reply: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export function conversationWindow(messages: ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);
  while (recent.length > 1 && recent.reduce((total, message) => total + message.content.length, 0) > MAX_HISTORY_CHARS) recent.shift();
  return recent;
}
