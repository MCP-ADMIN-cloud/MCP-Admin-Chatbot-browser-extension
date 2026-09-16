var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_openai = __toESM(require("openai"), 1);
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "50mb" }));
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
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
  app.post("/api/mcp", async (req, res) => {
    try {
      const { url, method, params, headers } = req.body;
      const rpcBody = {
        jsonrpc: "2.0",
        id: Math.floor(Math.random() * 1e6).toString(),
        method,
        params
      };
      const mcpRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers || {}
        },
        body: JSON.stringify(rpcBody)
      });
      if (!mcpRes.ok) {
        return res.status(mcpRes.status).json({ error: await mcpRes.text() });
      }
      const data = await mcpRes.json();
      res.json(data);
    } catch (error) {
      console.error("MCP Proxy Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });
  app.post("/api/llm", async (req, res) => {
    try {
      const { provider, apiKey, model, messages, tools } = req.body;
      if (provider === "openai") {
        if (!apiKey) throw new Error("OpenAI API key is required");
        const openai = new import_openai.default({ apiKey });
        const cleanMessages = messages.map((m) => {
          const cleanMsg = { role: m.role, content: m.content || null };
          if (m.name) cleanMsg.name = m.name;
          if (m.tool_calls) cleanMsg.tool_calls = m.tool_calls;
          if (m.tool_call_id) cleanMsg.tool_call_id = m.tool_call_id;
          return cleanMsg;
        });
        const response = await openai.chat.completions.create({
          model: model || "gpt-4o-mini",
          messages: cleanMessages,
          tools: tools?.length > 0 ? tools : void 0
        });
        res.json(response);
      } else if (provider === "gemini") {
        const key = apiKey || process.env.GEMINI_API_KEY;
        if (!key) throw new Error("Gemini API key is required");
        const ai = new import_genai.GoogleGenAI({ apiKey: key });
        const contents = messages.map((m) => {
          if (m.role === "user") {
            return { role: "user", parts: [{ text: m.content }] };
          }
          if (m.role === "assistant") {
            if (m.tool_calls && m.tool_calls.length > 0) {
              return {
                role: "model",
                parts: m.tool_calls.map((tc) => ({
                  functionCall: {
                    name: tc.function.name,
                    args: JSON.parse(tc.function.arguments || "{}")
                  }
                }))
              };
            }
            return { role: "model", parts: [{ text: m.content || "" }] };
          }
          if (m.role === "tool") {
            return {
              role: "user",
              // Gemini treats tool responses as user role
              parts: [
                {
                  functionResponse: {
                    name: m.name,
                    response: JSON.parse(m.content || "{}")
                  }
                }
              ]
            };
          }
          return { role: "user", parts: [{ text: m.content || "" }] };
        });
        const geminiTools = tools && tools.length > 0 ? [{ functionDeclarations: tools.map((t) => t.function) }] : void 0;
        const response = await ai.models.generateContent({
          model: model || "gemini-2.5-flash",
          contents,
          tools: geminiTools
        });
        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        if (part?.functionCall) {
          const calls = candidate.content.parts.filter((p) => p.functionCall).map((p) => ({
            id: "call_" + Math.random().toString(36).substr(2, 9),
            type: "function",
            function: {
              name: p.functionCall.name,
              arguments: JSON.stringify(p.functionCall.args)
            }
          }));
          res.json({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: calls
                }
              }
            ]
          });
        } else {
          res.json({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: part?.text || ""
                }
              }
            ]
          });
        }
      } else if (provider === "ollama") {
        const { ollamaUrl } = req.body;
        const baseUrl = ollamaUrl || "http://localhost:11434";
        const openai = new import_openai.default({
          apiKey: "ollama",
          baseURL: `${baseUrl.replace(/\/$/, "")}/v1`
        });
        const cleanMessages = messages.map((m) => {
          const cleanMsg = { role: m.role, content: m.content || null };
          if (m.name) cleanMsg.name = m.name;
          if (m.tool_calls) cleanMsg.tool_calls = m.tool_calls;
          if (m.tool_call_id) cleanMsg.tool_call_id = m.tool_call_id;
          return cleanMsg;
        });
        const response = await openai.chat.completions.create({
          model: model || "llama3.2",
          messages: cleanMessages,
          tools: tools?.length > 0 ? tools : void 0
        });
        res.json(response);
      } else {
        throw new Error("Invalid provider");
      }
    } catch (error) {
      console.error("LLM Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });
  app.post("/api/models", async (req, res) => {
    try {
      const { provider, apiKey } = req.body;
      if (provider === "openai") {
        if (!apiKey) return res.json([]);
        const openai = new import_openai.default({ apiKey });
        const models = await openai.models.list();
        const chatModels = models.data.map((m) => m.id).filter((id) => id.includes("gpt") || id.includes("o1") || id.includes("o3"));
        res.json(chatModels);
      } else if (provider === "gemini") {
        const key = apiKey || process.env.GEMINI_API_KEY;
        if (!key) return res.json([]);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
        );
        if (!response.ok) throw new Error("Failed to fetch Gemini models");
        const data = await response.json();
        const chatModels = data.models.filter((m) => m.supportedGenerationMethods.includes("generateContent")).map((m) => m.name.replace("models/", ""));
        res.json(chatModels);
      } else if (provider === "ollama") {
        const { ollamaUrl } = req.body;
        const baseUrl = ollamaUrl || "http://localhost:11434";
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`);
        if (!response.ok) throw new Error("Failed to fetch Ollama models");
        const data = await response.json();
        const chatModels = data.models.map((m) => m.name);
        res.json(chatModels);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("Models Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
