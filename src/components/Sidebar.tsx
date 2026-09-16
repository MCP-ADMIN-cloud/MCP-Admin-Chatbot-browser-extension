import { ChatSession } from "../types";
import { MessageSquare, Plus, Download, Settings as SettingsIcon, Trash2 } from "lucide-react";

interface Props {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({ sessions, currentSessionId, onSelect, onNew, onDelete, onExport, onOpenSettings }: Props) {
  return (
    <div className="flex h-full w-[260px] flex-col border-r border-neutral-200/50 bg-[#FAFAFA] dark:border-white/5 dark:bg-[#09090b]/40 backdrop-blur-xl z-20">
      <div className="p-5">
        <button
          onClick={onNew}
          className="flex w-full items-center justify-center space-x-2 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 dark:from-white dark:to-neutral-200 px-4 py-2.5 text-sm font-semibold text-white dark:text-neutral-950 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all active:scale-[0.98]"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm cursor-pointer transition-colors ${
              currentSessionId === s.id
                ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white shadow-sm border border-neutral-200/50 dark:border-white/5"
                : "text-neutral-500 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-white/5 border border-transparent"
            }`}
            onClick={() => onSelect(s.id)}
          >
            <div className="flex items-center space-x-2 truncate pr-2">
              <MessageSquare size={14} className={`shrink-0 ${currentSessionId === s.id ? 'text-indigo-500 dark:text-indigo-400' : 'text-neutral-400'}`} strokeWidth={2} />
              <span className="truncate font-medium">{s.title}</span>
            </div>
            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExport(s.id);
                }}
                className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-indigo-500 transition-colors"
                title="Export as Markdown"
              >
                <Download size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
                className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-red-500 transition-colors"
                title="Delete chat"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-neutral-200/50 p-5 dark:border-white/5 bg-gradient-to-t from-[#FAFAFA] to-transparent dark:from-[#09090b]">
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center space-x-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-200/60 dark:text-neutral-400 dark:hover:bg-white/5 transition-all"
        >
          <SettingsIcon size={16} strokeWidth={2.5} />
          <span>Settings</span>
        </button>
        <div className="mt-4 text-center text-[10px] font-bold tracking-widest text-neutral-400 dark:text-neutral-600 uppercase">
          MCP ADMIN | Zyven Technologies 2026
        </div>
      </div>
    </div>
  );
}
