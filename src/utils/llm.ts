import { Message, Settings, McpTool } from "../types";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

export function normalizeOllamaUrls(rawUrl?: string) {
  let url = (rawUrl || "http://localhost:11434").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) {
    url = "http://" + url;
  }
  // Strip trailing /v1 if user appended it
  const rootUrl = url.endsWith("/v1") ? url.slice(0, -3).replace(/\/+$/, "") : url;
  const v1Url = `${rootUrl}/v1`;
  return { rootUrl, v1Url };
}

// Background fetch helper when running in Chrome extension
async function bgFetch(url: string, options?: any): Promise<string | null> {
  if (!isExtension) return null;
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "BG_FETCH", url, options }, (res) => {
        if (chrome.runtime.lastError || !res?.ok) {
          resolve(null);
        } else {
          resolve(res.data);
        }
      });
    } catch {
      resolve(null);
    }
  });
}

// Robust SSE stream parser that buffers lines across chunk boundaries
async function parseSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onUpdate?: (text: string) => void
): Promise<{ role: string; content: string | null; tool_calls?: any[] }> {
  const decoder = new TextDecoder();
  let fullContent = "";
  let toolCalls: any[] = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // Keep the last potentially incomplete line in buffer
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      let payload = line;
      if (payload.startsWith("data: ")) {
        payload = payload.slice(6).trim();
      }
      if (payload === "[DONE]") continue;

      try {
        const data = JSON.parse(payload);
        // OpenAI / vLLM / Ollama-v1 delta format
        const delta = data.choices?.[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          if (onUpdate) onUpdate(fullContent);
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? toolCalls.length;
            if (!toolCalls[idx]) {
              toolCalls[idx] = { ...tc };
            } else {
              if (tc.function?.arguments) {
                toolCalls[idx].function.arguments =
                  (toolCalls[idx].function.arguments || "") + tc.function.arguments;
              }
            }
          }
        }
        // Ollama native format { message: { content: "..." } }
        if (data.message?.content) {
          fullContent += data.message.content;
          if (onUpdate) onUpdate(fullContent);
        }
      } catch {
        // Chunk is not complete JSON or is a ping; ignore
      }
    }
  }

  const validToolCalls = toolCalls.filter(Boolean);
  if (validToolCalls.length > 0) {
    return {
      role: "assistant",
      content: fullContent || null,
      tool_calls: validToolCalls,
    };
  }

  return {
    role: "assistant",
    content: fullContent,
  };
}

export async function fetchModels(settings: Settings): Promise<string[]> {
  const { provider } = settings;
  const apiKey = provider === "openai" ? settings.openaiKey : settings.geminiKey;
  try {
    if (provider === "ollama") {
      const { rootUrl, v1Url } = normalizeOllamaUrls(settings.ollamaUrl);

      // 1. Try direct Ollama native /api/tags
      try {
        const response = await fetch(`${rootUrl}/api/tags`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.models) && data.models.length > 0) {
            return data.models.map((m: any) => m.name || m.model || m.id);
          }
        }
      } catch (e) {
        // Fallback
      }

      // 2. Try direct OpenAI-compatible /v1/models
      try {
        const response = await fetch(`${v1Url}/models`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.data) && data.data.length > 0) {
            return data.data.map((m: any) => m.id);
          }
        }
      } catch (e) {
        // Fallback
      }

      // 3. Try background service worker fetch in Chrome Extension (bypasses extension page CORS)
      if (isExtension) {
        try {
          const bgDataTags = await bgFetch(`${rootUrl}/api/tags`);
          if (bgDataTags) {
            const data = JSON.parse(bgDataTags);
            if (Array.isArray(data.models) && data.models.length > 0) {
              return data.models.map((m: any) => m.name || m.model || m.id);
            }
          }
        } catch (e) {
          // Fallback
        }

        try {
          const bgDataModels = await bgFetch(`${v1Url}/models`);
          if (bgDataModels) {
            const data = JSON.parse(bgDataModels);
            if (Array.isArray(data.data) && data.data.length > 0) {
              return data.data.map((m: any) => m.id);
            }
          }
        } catch (e) {
          // Fallback
        }
      }

      // 4. Try server-side proxy
      try {
        const res = await fetch("/api/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, apiKey, ollamaUrl: settings.ollamaUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) return data;
        }
      } catch (e) {
        // Ignore
      }

      throw new Error(`Failed to fetch models from ${rootUrl}. Please verify endpoint URL and reachability.`);
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
  mcpTools: McpTool[],
  onUpdate?: (text: string) => void
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
  
  if (settings.provider === "ollama") {
    const { rootUrl, v1Url } = normalizeOllamaUrls(settings.ollamaUrl);
    
    const cleanMessages = messages.map((m: any) => {
      const cleanMsg: any = { role: m.role, content: m.content || null };
      if (m.name) cleanMsg.name = m.name;
      if (m.tool_calls) cleanMsg.tool_calls = m.tool_calls;
      if (m.tool_call_id) cleanMsg.tool_call_id = m.tool_call_id;
      return cleanMsg;
    });

    let res: Response | null = null;
    let fetchError: any = null;

    try {
      res = await fetch(`${v1Url}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer ollama"
        },
        body: JSON.stringify({
          model: settings.model || "llama3.2",
          messages: cleanMessages,
          tools: tools?.length > 0 ? tools : undefined,
          stream: true,
        })
      });
    } catch (err: any) {
      fetchError = err;
    }

    // Fallback to server streaming proxy if client direct fetch failed
    if ((!res || !res.ok) && !isExtension) {
      try {
        const proxyRes = await fetch("/api/llm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "ollama",
            apiKey,
            model: settings.model,
            messages,
            tools,
            ollamaUrl: settings.ollamaUrl,
            stream: true,
          }),
        });
        if (proxyRes.ok && proxyRes.body) {
          const reader = proxyRes.body.getReader();
          return await parseSseStream(reader, onUpdate);
        }
      } catch (e) {
        // Fall through
      }
    }

    if (!res) {
      throw new Error(`Failed to connect to Ollama at ${v1Url}: ${fetchError?.message || "Network error"}`);
    }

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error(`Ollama blocked the request (403). Please verify CORS settings (OLLAMA_ORIGINS="*" ollama serve) on ${rootUrl}`);
      }
      throw new Error(`Ollama Error: ${res.status} ${res.statusText}`);
    }

    if (res.body) {
      const reader = res.body.getReader();
      return await parseSseStream(reader, onUpdate);
    }

    const data = await res.json();
    return data.choices[0].message;
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
        stream: true,
      }),
    });

    if (res.ok && res.body) {
      const reader = res.body.getReader();
      return await parseSseStream(reader, onUpdate);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (onUpdate && data.choices[0]?.message?.content) {
      onUpdate(data.choices[0].message.content);
    }
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

    const responseStream = await openai.chat.completions.create({
      model: settings.model || "gpt-4o-mini",
      messages: cleanMessages,
      tools: tools?.length > 0 ? (tools as any) : undefined,
      stream: true,
    });
    
    let fullContent = "";
    let toolCalls: any[] = [];
    
    for await (const chunk of responseStream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        fullContent += delta.content;
        if (onUpdate) onUpdate(fullContent);
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCalls[tc.index]) {
            toolCalls[tc.index] = { ...tc };
          } else {
            if (tc.function?.arguments) {
              toolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }
      }
    }
    
    if (toolCalls.length > 0) {
      return { role: "assistant", content: fullContent || null, tool_calls: toolCalls.filter(Boolean) };
    }
    
    return { role: "assistant", content: fullContent };

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

    const responseStream = await ai.models.generateContentStream({
      model: settings.model || "gemini-2.5-flash",
      contents,
      tools: geminiTools,
    });

    let fullContent = "";
    let toolCalls: any[] = [];

    for await (const chunk of responseStream) {
      const candidate = chunk.candidates?.[0];
      const part = candidate?.content?.parts?.[0];
      
      if (part?.text) {
        fullContent += part.text;
        if (onUpdate) onUpdate(fullContent);
      } else if (part?.functionCall) {
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
        toolCalls.push(...calls);
      }
    }

    if (toolCalls.length > 0) {
      return {
        role: "assistant",
        content: fullContent || null,
        tool_calls: toolCalls,
      };
    }
    
    return {
      role: "assistant",
      content: fullContent,
    };
  }

  throw new Error("Invalid provider");
}
