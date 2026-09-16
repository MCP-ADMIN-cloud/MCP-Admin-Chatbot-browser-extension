import { Settings } from "../types";
import { X, RefreshCw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { fetchModels } from "../utils/llm";

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

  const handleChange = (k: keyof Settings, v: string) => {
    setLocal((prev) => ({ ...prev, [k]: v }));
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
            <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">MCP Admin API Key (Bearer)</label>
            <input
              type="password"
              value={local.mcpAdminApiKey}
              onChange={(e) => handleChange("mcpAdminApiKey", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-neutral-900/50 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
              placeholder="sk_..."
            />
            <p className="text-[11px] text-neutral-500 font-medium">Required to fetch and interact with your MCP servers.</p>
          </div>

          <div className="my-5 border-t border-neutral-200/60 dark:border-white/5" />

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">LLM Provider</label>
            <select
              value={local.provider}
              onChange={(e) => handleChange("provider", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-neutral-900/50 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            >
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Gemini API Key</label>
            <input
              type="password"
              value={local.geminiKey}
              onChange={(e) => handleChange("geminiKey", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-neutral-900/50 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
              placeholder="Leave blank to use server key"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">OpenAI API Key</label>
            <input
              type="password"
              value={local.openaiKey}
              onChange={(e) => handleChange("openaiKey", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-neutral-900/50 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
              placeholder="sk-..."
            />
          </div>
          
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
