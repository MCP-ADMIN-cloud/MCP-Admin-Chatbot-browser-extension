export interface Settings {
  openaiKey: string;
  geminiKey: string;
  mcpAdminApiKey: string;
  theme: "light" | "dark";
  provider: "gemini" | "openai";
  model: string;
}

export interface McpServerDef {
  id: string;
  name?: string;
  [key: string]: any;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  name?: string; // For tool roles
  tool_calls?: ToolCall[];
  tool_call_id?: string; // Required by OpenAI to map tool responses back to the call
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
  mcpServerId?: string;
  mcpTransport?: "http" | "sse";
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
}
