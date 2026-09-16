import { Settings } from "../types";
import { X, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { fetchModels } from "../utils/llm";
import { fetchMcpServers } from "../utils/mcp";

interface Props {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: Props) {
  const [local, setLocal] = useState<Settings>(settings);
  
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");
  
  const [isTestingMcp, setIsTestingMcp] = useState(false);
  const [mcpTestStatus, setMcpTestStatus] = useState<"idle" | "success" | "error">("idle");
  const [mcpTestMsg, setMcpTestMsg] = useState("");

  const handleChange = (k: keyof Settings, v: string) => {
    setLocal((prev) => ({ ...prev, [k]: v }));
  };

  const handleTestMcpKey = async () => {
    if (!local.mcpAdminApiKey) return;
    setIsTestingMcp(true);
    setMcpTestStatus("idle");
    setMcpTestMsg("");
    try {
      await fetchMcpServers(local.mcpAdminApiKey);
      setMcpTestStatus("success");
      setMcpTestMsg("Connection successful");
    } catch (e: any) {
      setMcpTestStatus("error");
      setMcpTestMsg(e.message || "Failed to connect");
    } finally {
      setIsTestingMcp(false);
    }
  };

  const loadModels = async () => {
    setIsLoadingModels(true);
    setModelsError("");
    try {
      const apiKey = local.provider === "openai" ? local.openaiKey : local.geminiKey;
      const models = await fetchModels(local.provider, apiKey);
      if (models.length > 0) {
        setAvailableModels(models);
        if (!models.includes(local.model)) {
          // If current model isn't in the list, default to first available
          setLocal(prev => ({ ...prev, model: models[0] }));
        }
      } else {
        setModelsError("No models found. Check API key.");
      }
    } catch (e: any) {
      setModelsError(e.message || "Failed to load models");
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    loadModels();
    setMcpTestStatus("idle");
  }, [local.provider]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#09090b] dark:text-neutral-100 border border-neutral-200/50 dark:border-white/10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Settings</h2>
          <button onClick={onClose} className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-neutral-100">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">MCP Admin API Key (Bearer)</label>
              <button 
                onClick={handleTestMcpKey}
                disabled={isTestingMcp || !local.mcpAdminApiKey}
                className="flex items-center text-[11px] font-bold tracking-wider uppercase text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={12} strokeWidth={2.5} className={`mr-1 ${isTestingMcp ? 'animate-spin' : ''}`} />
                Test
              </button>
            </div>
            <input
              type="password"
              value={local.mcpAdminApiKey}
              onChange={(e) => {
                handleChange("mcpAdminApiKey", e.target.value);
                setMcpTestStatus("idle");
              }}
              className={`w-full rounded-xl border bg-neutral-50 px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-4 dark:bg-neutral-900/50 ${
                mcpTestStatus === 'error' ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10 dark:border-red-500' :
                mcpTestStatus === 'success' ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/10 dark:border-emerald-500' :
                'border-neutral-300 focus:border-indigo-500 focus:ring-indigo-500/10 dark:border-white/10 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20'
              }`}
              placeholder="sk_..."
            />
            {mcpTestStatus === 'error' && <p className="text-[11px] font-medium text-red-500 flex items-center mt-1"><XCircle size={12} className="mr-1"/> {mcpTestMsg}</p>}
            {mcpTestStatus === 'success' && <p className="text-[11px] font-medium text-emerald-500 flex items-center mt-1"><CheckCircle2 size={12} className="mr-1"/> {mcpTestMsg}</p>}
            {mcpTestStatus === 'idle' && <p className="text-[11px] text-neutral-500 font-medium mt-1">Required to fetch and interact with your MCP servers.</p>}
          </div>

          <div className="my-5 border-t border-neutral-200/60 dark:border-white/5" />

          <div className="flex space-x-1 p-1 bg-neutral-100 dark:bg-neutral-900/80 rounded-xl mb-4">
            <button
              onClick={() => handleChange("provider", "gemini")}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                local.provider === "gemini" 
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm" 
                  : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              Gemini
            </button>
            <button
              onClick={() => handleChange("provider", "openai")}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                local.provider === "openai" 
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm" 
                  : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              OpenAI
            </button>
          </div>

          {local.provider === "gemini" && (
            <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
              <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Gemini API Key</label>
              <input
                type="password"
                value={local.geminiKey}
                onChange={(e) => handleChange("geminiKey", e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-neutral-900/50 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
                placeholder="Leave blank to use server key"
              />
            </div>
          )}

          {local.provider === "openai" && (
            <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
              <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">OpenAI API Key</label>
              <input
                type="password"
                value={local.openaiKey}
                onChange={(e) => handleChange("openaiKey", e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-neutral-900/50 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
                placeholder="sk-..."
              />
            </div>
          )}
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Model</label>
              <button 
                onClick={loadModels}
                disabled={isLoadingModels}
                className="flex items-center text-[11px] font-bold tracking-wider uppercase text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={12} strokeWidth={2.5} className={`mr-1 ${isLoadingModels ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            
            {availableModels.length > 0 ? (
              <select
                value={local.model}
                onChange={(e) => handleChange("model", e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-neutral-900/50 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
              >
                {availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={local.model}
                onChange={(e) => handleChange("model", e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-neutral-900/50 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
                placeholder={local.provider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini"}
              />
            )}
            
            {modelsError && (
              <p className="text-[11px] font-medium text-red-600 dark:text-red-400 mt-1">{modelsError}</p>
            )}
          </div>

          <div className="my-5 border-t border-neutral-200/60 dark:border-white/5" />

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Theme</label>
            <select
              value={local.theme}
              onChange={(e) => handleChange("theme", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-neutral-900/50 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors dark:text-neutral-300 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(local);
              onClose();
            }}
            className="rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:scale-105 transition-all active:scale-[0.98]"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
