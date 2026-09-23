import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  app.get("/api/mcp/servers", async (req, res) => {
    try {
      const apiKey = req.headers.authorization;
      if (!apiKey) return res.status(401).json({ error: "No API key provided" });
      const fetchRes = await fetch("https://mcpadmin.cloud/api/mcp", {
        headers: {
          "Authorization": apiKey,
          "Content-Type": "application/json"
        }
      });
      if (!fetchRes.ok) {
        return res.status(fetchRes.status).json({ error: await fetchRes.text() });
      }
      res.json(await fetchRes.json());
    } catch (e: any) {
      res.status(500).json({ error: String(e) });
    }
  });

  // Proxy for MCP requests to bypass CORS
  app.post("/api/mcp", async (req, res) => {
    try {
      const { url, method, params, headers } = req.body;
      const rpcBody = {
        jsonrpc: "2.0",
        id: Math.floor(Math.random() * 1000000).toString(),
        method,
        params,
      };

      const mcpRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(headers || {}),
        },
        body: JSON.stringify(rpcBody),
      });

      if (!mcpRes.ok) {
        return res.status(mcpRes.status).json({ error: await mcpRes.text() });
      }

      const data = await mcpRes.json();
      res.json(data);
    } catch (error: any) {
      console.error("MCP Proxy Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // LLM handler
  app.post("/api/llm", async (req, res) => {
    try {
      const { provider, apiKey, model, messages, tools, stream } = req.body;

      if (provider === "openai") {
        if (!apiKey) throw new Error("OpenAI API key is required");
        const openai = new OpenAI({ apiKey });
        
        const cleanMessages = messages.map((m: any) => {
          const cleanMsg: any = { role: m.role, content: m.content || null };
          if (m.name) cleanMsg.name = m.name;
          if (m.tool_calls) cleanMsg.tool_calls = m.tool_calls;
          if (m.tool_call_id) cleanMsg.tool_call_id = m.tool_call_id;
          return cleanMsg;
        });

        if (stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");

          const responseStream = await openai.chat.completions.create({
            model: model || "gpt-4o-mini",
            messages: cleanMessages,
            tools: tools?.length > 0 ? tools : undefined,
            stream: true,
          });

          for await (const chunk of responseStream) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
          res.write("data: [DONE]\n\n");
          return res.end();
        }

        const response = await openai.chat.completions.create({
          model: model || "gpt-4o-mini",
          messages: cleanMessages,
          tools: tools?.length > 0 ? tools : undefined,
        });
        res.json(response);
      } else if (provider === "gemini") {
        // Fallback to environment variable if client doesn't provide one
        const key = apiKey || process.env.GEMINI_API_KEY;
        if (!key) throw new Error("Gemini API key is required");
        
        const ai = new GoogleGenAI({ apiKey: key });

        // Map OpenAI message format to Gemini format
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
              role: "user", // Gemini treats tool responses as user role
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

        // Map tools
        const geminiTools =
          tools && tools.length > 0
            ? [{ functionDeclarations: tools.map((t: any) => t.function) }]
            : undefined;

        if (stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");

          const responseStream = await ai.models.generateContentStream({
            model: model || "gemini-2.5-flash",
            contents,
            tools: geminiTools,
          });

          for await (const chunk of responseStream) {
            const candidate = chunk.candidates?.[0];
            const part = candidate?.content?.parts?.[0];

            if (part?.text) {
              res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: part.text } }] })}\n\n`);
            } else if (part?.functionCall) {
              const calls = candidate.content.parts
                .filter((p: any) => p.functionCall)
                .map((p: any, idx: number) => ({
                  index: idx,
                  id: "call_" + Math.random().toString(36).substr(2, 9),
                  type: "function",
                  function: {
                    name: p.functionCall!.name,
                    arguments: JSON.stringify(p.functionCall!.args),
                  },
                }));
              res.write(`data: ${JSON.stringify({ choices: [{ delta: { tool_calls: calls } }] })}\n\n`);
            }
          }
          res.write("data: [DONE]\n\n");
          return res.end();
        }

        const response = await ai.models.generateContent({
          model: model || "gemini-2.5-flash",
          contents,
          tools: geminiTools,
        });

        // Map Gemini response back to OpenAI format for the client
        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.[0];

        if (part?.functionCall) {
          // It's a tool call
          const calls = candidate.content.parts
            .filter((p) => p.functionCall)
            .map((p) => ({
              id: "call_" + Math.random().toString(36).substr(2, 9),
              type: "function",
              function: {
                name: p.functionCall!.name,
                arguments: JSON.stringify(p.functionCall!.args),
              },
            }));

          res.json({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: calls,
                },
              },
            ],
          });
        } else {
          // Text response
          res.json({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: part?.text || "",
                },
              },
            ],
          });
        }
      } else if (provider === "ollama") {
        const { ollamaUrl } = req.body;
        let url = (ollamaUrl || "http://localhost:11434").trim().replace(/\/+$/, "");
        if (!/^https?:\/\//i.test(url)) {
          url = "http://" + url;
        }
        const rootUrl = url.endsWith("/v1") ? url.slice(0, -3).replace(/\/+$/, "") : url;
        const v1Url = `${rootUrl}/v1`;
        
        const openai = new OpenAI({ 
          apiKey: "ollama", 
          baseURL: v1Url
        });
        
        const cleanMessages = messages.map((m: any) => {
          const cleanMsg: any = { role: m.role, content: m.content || null };
          if (m.name) cleanMsg.name = m.name;
          if (m.tool_calls) cleanMsg.tool_calls = m.tool_calls;
          if (m.tool_call_id) cleanMsg.tool_call_id = m.tool_call_id;
          return cleanMsg;
        });

        if (stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");

          const responseStream = await openai.chat.completions.create({
            model: model || "llama3.2",
            messages: cleanMessages,
            tools: tools?.length > 0 ? tools : undefined,
            stream: true,
          });

          for await (const chunk of responseStream) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
          res.write("data: [DONE]\n\n");
          return res.end();
        }

        const response = await openai.chat.completions.create({
          model: model || "llama3.2",
          messages: cleanMessages,
          tools: tools?.length > 0 ? tools : undefined,
        });
        res.json(response);
      } else {
        throw new Error("Invalid provider");
      }
    } catch (error: any) {
      console.error("LLM Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/models", async (req, res) => {
    try {
      const { provider, apiKey } = req.body;
      if (provider === "openai") {
        if (!apiKey) return res.json([]);
        const openai = new OpenAI({ apiKey });
        const models = await openai.models.list();
        const chatModels = models.data
          .map((m) => m.id)
          .filter((id) => id.includes("gpt") || id.includes("o1") || id.includes("o3"));
        res.json(chatModels);
      } else if (provider === "gemini") {
        const key = apiKey || process.env.GEMINI_API_KEY;
        if (!key) return res.json([]);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
        );
        if (!response.ok) throw new Error("Failed to fetch Gemini models");
        const data = await response.json();
        const chatModels = data.models
          .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
          .map((m: any) => m.name.replace("models/", ""));
        res.json(chatModels);
      } else if (provider === "ollama") {
        const { ollamaUrl } = req.body;
        let url = (ollamaUrl || "http://localhost:11434").trim().replace(/\/+$/, "");
        if (!/^https?:\/\//i.test(url)) {
          url = "http://" + url;
        }
        const rootUrl = url.endsWith("/v1") ? url.slice(0, -3).replace(/\/+$/, "") : url;
        const v1Url = `${rootUrl}/v1`;

        try {
          const response = await fetch(`${rootUrl}/api/tags`);
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.models)) {
              return res.json(data.models.map((m: any) => m.name || m.model || m.id));
            }
          }
        } catch (e) {
          // Fall through to /v1/models
        }

        try {
          const response = await fetch(`${v1Url}/models`);
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.data)) {
              return res.json(data.data.map((m: any) => m.id));
            }
          }
        } catch (e) {
          // Both failed
        }

        throw new Error(`Failed to fetch models from ${rootUrl}`);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      console.error("Models Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
