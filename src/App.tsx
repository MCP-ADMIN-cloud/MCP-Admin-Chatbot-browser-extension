import { useEffect, useState, useRef, useCallback } from "react";
import { Settings, ChatSession, Message, McpTool, McpServerDef } from "./types";
import { loadSettings, saveSettings, loadSessions, saveSessions } from "./utils/storage";
import { SettingsModal } from "./components/Settings";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { v4 as uuidv4 } from "uuid";
import { fetchMcpTools, callMcpTool, fetchMcpServers } from "./utils/mcp";
import { chatCompletion } from "./utils/llm";
import { Menu, Server, RefreshCw } from "lucide-react";

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    sessions.length > 0 ? sessions[0].id : null
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [mcpServers, setMcpServers] = useState<McpServerDef[]>([]);
  const [isFetchingServers, setIsFetchingServers] = useState(false);
  const [mcpTools, setMcpTools] = useState<McpTool[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Layout resizing state
  const [width, setWidth] = useState(800);
  const isDragging = useRef(false);

  useEffect(() => {
    if (settings.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.theme]);

  // Load MCP servers when API key changes
  const loadServers = useCallback(async () => {
    if (settings.mcpAdminApiKey) {
      setIsFetchingServers(true);
      try {
        const servers = await fetchMcpServers(settings.mcpAdminApiKey);
        setMcpServers(servers);
      } catch (e) {
        console.error("Failed to load servers", e);
      } finally {
        setIsFetchingServers(false);
      }
    } else {
      setMcpServers([]);
    }
  }, [settings.mcpAdminApiKey]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  // Load tools for the current session's selected server
  useEffect(() => {
    if (currentSession?.mcpServerId && settings.mcpAdminApiKey) {
      fetchMcpTools(
        settings.mcpAdminApiKey, 
        currentSession.mcpServerId, 
        currentSession.mcpTransport || "http"
      ).then(setMcpTools);
    } else {
      setMcpTools([]);
    }
  }, [currentSession?.mcpServerId, currentSession?.mcpTransport, settings.mcpAdminApiKey]);

  const saveAndSetSessions = (newSessions: ChatSession[]) => {
    setSessions(newSessions);
    saveSessions(newSessions);
  };

  const handleNewChat = () => {
    const defaultServerId = mcpServers.length > 0 ? mcpServers[0].id : undefined;
    const newSession: ChatSession = {
      id: uuidv4(),
      title: "New Chat",
      updatedAt: Date.now(),
      messages: [],
      mcpServerId: defaultServerId,
      mcpTransport: "http",
    };
    saveAndSetSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
  };

  const updateCurrentSession = (updates: Partial<ChatSession>) => {
    if (!currentSessionId) return;
    saveAndSetSessions(
      sessions.map((s) => (s.id === currentSessionId ? { ...s, ...updates, updatedAt: Date.now() } : s))
    );
  };

  const handleDelete = (id: string) => {
    const newSessions = sessions.filter((s) => s.id !== id);
    saveAndSetSessions(newSessions);
    if (currentSessionId === id) {
      setCurrentSessionId(newSessions.length > 0 ? newSessions[0].id : null);
    }
  };

  const handleExport = (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    
    const content = session.messages
      .map((m) => {
        let text = `### ${m.role === "user" ? "You" : m.role === "tool" ? "Tool: " + m.name : "AI"}\n\n`;
        if (m.content) text += `${m.content}\n\n`;
        if (m.tool_calls) {
          text += m.tool_calls.map((tc) => `_Used tool: ${tc.function.name}_`).join("\n") + "\n\n";
        }
        return text;
      })
      .join("---\n\n");

    const blob = new Blob([`# ${session.title}\n\n${content}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = async (content: string) => {
    let session = currentSession;
    if (!session) {
      const defaultServerId = mcpServers.length > 0 ? mcpServers[0].id : undefined;
      session = {
        id: uuidv4(),
        title: content.substring(0, 30) + "...",
        updatedAt: Date.now(),
        messages: [],
        mcpServerId: defaultServerId,
        mcpTransport: "http",
      };
      saveAndSetSessions([session, ...sessions]);
      setCurrentSessionId(session.id);
    } else if (session.messages.length === 0) {
      updateCurrentSession({ title: content.substring(0, 30) + "..." });
    }

    const userMessage: Message = { id: uuidv4(), role: "user", content };
    let currentMessages = [...session.messages, userMessage];
    updateCurrentSession({ messages: currentMessages });

    setIsGenerating(true);

    try {
      let isDone = false;
      
      while (!isDone) {
        const aiMessageId = uuidv4();
        let currentMessagesWithPlaceholder = [...currentMessages, {
          id: aiMessageId,
          role: "assistant",
          content: "",
        }];
        updateCurrentSession({ messages: currentMessagesWithPlaceholder });

        const aiResponse = await chatCompletion(settings, currentMessages, mcpTools, (text) => {
          updateCurrentSession({ 
            messages: currentMessagesWithPlaceholder.map(m => 
              m.id === aiMessageId ? { ...m, content: text } : m
            ) 
          });
        });
        
        const aiMessage: Message = {
          id: aiMessageId,
          role: "assistant",
          content: aiResponse.content || "",
          tool_calls: aiResponse.tool_calls,
        };
        currentMessages = [...currentMessages, aiMessage];
        updateCurrentSession({ messages: currentMessages });

        if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0 && session.mcpServerId) {
          for (const tc of aiResponse.tool_calls) {
            let resultStr = "";
            try {
              const args = JSON.parse(tc.function.arguments || "{}");
              const result = await callMcpTool(
                settings.mcpAdminApiKey,
                session.mcpServerId,
                session.mcpTransport || "http",
                tc.function.name,
                args
              );
              resultStr = typeof result === "string" ? result : JSON.stringify(result);
            } catch (err: any) {
              resultStr = `Error executing tool: ${err.message}`;
            }

            const toolMsg: Message = {
              id: uuidv4(),
              role: "tool",
              content: resultStr,
              name: tc.function.name,
              tool_call_id: tc.id,
            };
            currentMessages = [...currentMessages, toolMsg];
            updateCurrentSession({ messages: currentMessages });
          }
        } else {
          isDone = true;
        }
      }
    } catch (error: any) {
      console.error(error);
      const errorMsg: Message = {
        id: uuidv4(),
        role: "assistant",
        content: `**Error:** ${error.message || "An unexpected error occurred."}`,
      };
      updateCurrentSession({ messages: [...currentMessages, errorMsg] });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    document.body.style.cursor = "ew-resize";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 320 && newWidth < window.innerWidth - 100) {
        setWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "default";
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div className="flex h-screen w-screen justify-end bg-neutral-900/20 text-neutral-900 dark:text-neutral-50 overflow-hidden">
      
      <div 
        className="relative flex h-full bg-white shadow-[0_0_40px_rgba(0,0,0,0.1)] dark:bg-[#09090b] border-l border-neutral-200/50 dark:border-white/5"
        style={{ width: `${width}px` }}
      >
        <div 
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-transparent hover:bg-indigo-500/50 z-50 transition-colors"
          onMouseDown={handleMouseDown}
        />

        {isSidebarOpen && (
          <Sidebar
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelect={setCurrentSessionId}
            onNew={handleNewChat}
            onDelete={handleDelete}
            onExport={handleExport}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        <div className="flex flex-1 flex-col overflow-hidden relative">
          <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-neutral-200/60 bg-white/70 px-5 backdrop-blur-xl dark:border-white/5 dark:bg-[#09090b]/70 z-10">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-neutral-100"
            >
              <Menu size={18} strokeWidth={2.5} />
            </button>

            <div className="flex items-center space-x-2 bg-neutral-100/50 dark:bg-white/5 px-3 py-1.5 rounded-full border border-neutral-200/60 dark:border-white/5">
              <Server size={14} className="text-indigo-500 dark:text-indigo-400" />
              <select
                className="bg-transparent text-sm font-semibold outline-none dark:bg-transparent cursor-pointer text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors"
                value={currentSession?.mcpServerId || ""}
                onChange={(e) => updateCurrentSession({ mcpServerId: e.target.value })}
                disabled={!currentSession || currentSession.messages.length > 0}
                title={currentSession?.messages.length! > 0 ? "Cannot change server after chat has started" : "Select MCP Server"}
              >
                <option value="" disabled>Select MCP Server</option>
                {mcpServers.map((s) => (
                  <option key={s.id} value={s.id} className="dark:bg-neutral-900">
                    {s.name || s.id}
                  </option>
                ))}
              </select>
              
              {currentSession?.mcpServerId && (
                <select
                  className="bg-transparent text-[11px] font-bold tracking-wider uppercase outline-none dark:bg-transparent ml-2 border-l pl-3 border-neutral-300 dark:border-neutral-700 cursor-pointer text-neutral-500"
                  value={currentSession?.mcpTransport || "http"}
                  onChange={(e) => updateCurrentSession({ mcpTransport: e.target.value as "http" | "sse" })}
                  disabled={!currentSession || currentSession.messages.length > 0}
                >
                  <option value="http" className="dark:bg-neutral-900">HTTP</option>
                  <option value="sse" className="dark:bg-neutral-900">SSE</option>
                </select>
              )}
              <button 
                onClick={loadServers} 
                disabled={isFetchingServers}
                className="ml-2 p-1 text-neutral-400 hover:text-indigo-500 dark:hover:text-indigo-400 disabled:opacity-50 transition-colors"
                title="Refresh Servers"
              >
                <RefreshCw size={14} strokeWidth={2.5} className={isFetchingServers ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="text-[11px] font-bold tracking-widest uppercase text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-white/5 px-2 py-1 rounded-md">
              {settings.provider === "gemini" ? "Gemini" : "OpenAI"}
            </div>
          </div>

          <ChatArea
            messages={currentSession?.messages || []}
            isGenerating={isGenerating}
            mcpTools={mcpTools}
            onSendMessage={handleSendMessage}
            settings={settings}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </div>

        {isSettingsOpen && (
          <SettingsModal
            settings={settings}
            onSave={(newSettings) => {
              setSettings(newSettings);
              saveSettings(newSettings);
            }}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

