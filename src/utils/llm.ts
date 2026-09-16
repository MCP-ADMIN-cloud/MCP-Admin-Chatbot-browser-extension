import { Message, Settings, McpTool } from "../types";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

export async function fetchModels(settings: Settings): Promise<string[]> {
  const { provider } = settings;
  const apiKey = provider === "openai" ? settings.openaiKey : settings.geminiKey;
  try {
    // Ollama MUST be fetched from the client side because the cloud server cannot reach the user's localhost
    if (provider === "ollama") {
      const baseUrl = settings.ollamaUrl || "http://localhost:11434";
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`);
      if (!response.ok) throw new Error("Failed to fetch Ollama models");
      const data = await response.json();
      const chatModels = data.models.map((m: any) => m.name);
      return chatModels;
    }

    if (!isExtension) {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, ollamaUrl: settings.ollamaUrl }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return Array.isArray(data) ? data : [];
    }

    if (provider === "openai") {
      if (!apiKey) return [];
      const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
      const models = await openai.models.list();
      const chatModels = models.data
        .map((m) => m.id)
        .filter((id) => id.includes("gpt") || id.includes("o1") || id.includes("o3"));
      return chatModels;
    } else if (provider === "gemini") {
      if (!apiKey) return [];
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (!response.ok) throw new Error("Failed to fetch Gemini models");
      const data = await response.json();
      const chatModels = data.models
        .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
        .map((m: any) => m.name.replace("models/", ""));
      return chatModels;
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return [];
  }
}

export async function chatCompletion(
  settings: Settings,
  messages: Message[],
  mcpTools: McpTool[]
) {
  const tools = mcpTools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema || { type: "object", properties: {} },
    },
  }));

  const apiKey = settings.provider === "openai" ? settings.openaiKey : settings.geminiKey;
  
  // Ollama MUST be fetched from the client side
  if (settings.provider === "ollama") {
    const baseUrl = settings.ollamaUrl || "http://localhost:11434";
    const openai = new OpenAI({ 
      apiKey: "ollama", 
      baseURL: `${baseUrl.replace(/\/$/, '')}/v1`,
      dangerouslyAllowBrowser: true 
    });
    
    const cleanMessages = messages.map((m: any) => {
      const cleanMsg: any = { role: m.role, content: m.content || null };
      if (m.name) cleanMsg.name = m.name;
      if (m.tool_calls) cleanMsg.tool_calls = m.tool_calls;
      if (m.tool_call_id) cleanMsg.tool_call_id = m.tool_call_id;
      return cleanMsg;
    });

    const response = await openai.chat.completions.create({
      model: settings.model || "llama3.2",
      messages: cleanMessages,
      tools: tools?.length > 0 ? (tools as any) : undefined,
    });
    
    return response.choices[0].message;
  }

  if (!isExtension) {
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: settings.provider,
        apiKey,
        model: settings.model,
        messages,
        tools,
        ollamaUrl: settings.ollamaUrl,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.choices[0].message;
  }

  if (settings.provider === "openai") {
    if (!apiKey) throw new Error("OpenAI API key is required");
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    
    const cleanMessages = messages.map((m: any) => {
      const cleanMsg: any = { role: m.role, content: m.content || null };
      if (m.name) cleanMsg.name = m.name;
      if (m.tool_calls) cleanMsg.tool_calls = m.tool_calls;
      if (m.tool_call_id) cleanMsg.tool_call_id = m.tool_call_id;
      return cleanMsg;
    });

    const response = await openai.chat.completions.create({
      model: settings.model || "gpt-4o-mini",
      messages: cleanMessages,
      tools: tools?.length > 0 ? (tools as any) : undefined,
    });
    
    return response.choices[0].message;

  } else if (settings.provider === "gemini") {
    if (!apiKey) throw new Error("Gemini API key is required");
    
    const ai = new GoogleGenAI({ apiKey });
    
    const contents = messages.map((m: any) => {
      if (m.role === "user") {
        return { role: "user", parts: [{ text: m.content }] };
      }
      if (m.role === "assistant") {
        if (m.tool_calls && m.tool_calls.length > 0) {
          return {
            role: "model",
            parts: m.tool_calls.map((tc: any) => ({
              functionCall: {
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments || "{}"),
              },
            })),
          };
        }
        return { role: "model", parts: [{ text: m.content || "" }] };
      }
      if (m.role === "tool") {
        return {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: m.name,
                response: JSON.parse(m.content || "{}"),
              },
            },
          ],
        };
      }
      return { role: "user", parts: [{ text: m.content || "" }] };
    });

    const geminiTools = tools && tools.length > 0
      ? [{ functionDeclarations: tools.map((t: any) => t.function) }]
      : undefined;

    const response = await ai.models.generateContent({
      model: settings.model || "gemini-2.5-flash",
      contents,
      tools: geminiTools,
    });

    const candidate = response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    
    if (part?.functionCall) {
      const calls = candidate.content.parts
        .filter((p: any) => p.functionCall)
        .map((p: any) => ({
          id: "call_" + Math.random().toString(36).substr(2, 9),
          type: "function",
          function: {
            name: p.functionCall!.name,
            arguments: JSON.stringify(p.functionCall!.args),
          },
        }));
      
      return {
        role: "assistant",
        content: null,
        tool_calls: calls,
      };
    } else {
      return {
        role: "assistant",
        content: part?.text || "",
      };
    }
  }

  throw new Error("Invalid provider");
}
