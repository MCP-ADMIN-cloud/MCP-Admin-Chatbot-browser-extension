import { Message, McpTool } from "../types";
import { Send, Wrench, Bot, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  messages: Message[];
  isGenerating: boolean;
  mcpTools: McpTool[];
  onSendMessage: (content: string) => void;
}

export function ChatArea({ messages, isGenerating, mcpTools, onSendMessage }: Props) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA]/50 dark:bg-[#09090b]">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-neutral-500 dark:text-neutral-400">
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 dark:from-indigo-500/20 dark:to-indigo-500/5 shadow-inner border border-indigo-500/20">
              <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 blur-xl"></div>
              <Bot size={36} className="text-indigo-500 relative z-10" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 tracking-tight">How can I help you today?</h2>
            <p className="mt-3 text-sm max-w-sm leading-relaxed">
              Connect to an MCP server in Settings, and I can use its tools to assist you seamlessly.
            </p>
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-3xl rounded-tr-md bg-gradient-to-br from-neutral-800 to-neutral-900 dark:from-indigo-600 dark:to-blue-600 px-5 py-3 text-white shadow-lg shadow-neutral-900/10 dark:shadow-indigo-900/20 font-medium">
                  {m.content}
                </div>
              </div>
            );
          } else if (m.role === "assistant") {
            if (m.tool_calls && m.tool_calls.length > 0) {
              return (
                <div key={m.id} className="flex items-start space-x-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/5 shadow-sm text-neutral-500 dark:text-neutral-400">
                    <Wrench size={14} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col space-y-2 text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    {m.tool_calls.map((tc) => (
                      <div key={tc.id} className="rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white dark:bg-white/5 px-4 py-2 font-mono text-[13px] shadow-sm">
                        Running tool: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{tc.function.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            if (m.content) {
              return (
                <div key={m.id} className="flex items-start space-x-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/5 shadow-sm text-indigo-500">
                    <Bot size={16} strokeWidth={2} />
                  </div>
                  <div className="prose prose-sm prose-neutral max-w-[85%] dark:prose-invert bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-white/5 shadow-sm rounded-3xl rounded-tl-md px-6 py-4 mt-0.5">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              );
            }
          } else if (m.role === "tool") {
            return (
              <div key={m.id} className="flex items-start space-x-3 opacity-60 hover:opacity-100 transition-opacity">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-transparent text-neutral-400">
                  <Wrench size={14} />
                </div>
                <div className="max-w-[80%] overflow-x-auto rounded-xl border border-neutral-200/50 dark:border-white/5 bg-white/50 dark:bg-neutral-900/50 px-4 py-2.5 text-[11px] font-mono text-neutral-500 dark:text-neutral-400 mt-1">
                  Tool result ({m.name}): {m.content.length > 200 ? m.content.substring(0, 200) + "..." : m.content}
                </div>
              </div>
            );
          }
          return null;
        })}
        {isGenerating && (
          <div className="flex items-start space-x-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/5 shadow-sm text-indigo-500">
              <Bot size={16} strokeWidth={2} />
            </div>
            <div className="flex items-center space-x-1.5 h-8 mt-1">
              <div className="h-2 w-2 animate-bounce rounded-full bg-neutral-300 dark:bg-neutral-600" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-neutral-300 dark:bg-neutral-600 [animation-delay:0.15s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-neutral-300 dark:bg-neutral-600 [animation-delay:0.3s]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-neutral-200/60 bg-white/80 dark:border-white/5 dark:bg-[#09090b]/80 backdrop-blur-xl p-5 pt-4">
        <form
          onSubmit={handleSubmit}
          className="relative mx-auto flex w-full max-w-4xl items-end space-x-3 rounded-2xl border border-neutral-200/80 bg-white px-3 py-2.5 shadow-lg shadow-neutral-900/5 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/50 dark:border-white/10 dark:bg-neutral-900 dark:shadow-black/50 transition-all"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Message MCP Server..."
            className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-3 text-[15px] outline-none dark:text-neutral-100 placeholder:text-neutral-400"
            rows={1}
          />
          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            <Send size={18} strokeWidth={2.5} className="ml-1" />
          </button>
        </form>
        <div className="mt-3 flex justify-center items-center space-x-2 text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
          <Wrench size={12} />
          <span>MCP Tools Active: {mcpTools.length}</span>
        </div>
      </div>
    </div>
  );
}
