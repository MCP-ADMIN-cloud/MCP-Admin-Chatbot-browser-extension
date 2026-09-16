import { Settings, ChatSession } from "../types";
import { encryptData, decryptData } from "./encryption";

const SETTINGS_KEY = "mcp_chat_settings";
const SESSIONS_KEY = "mcp_chat_sessions";

export const defaultSettings: Settings = {
  openaiKey: "",
  geminiKey: "",
  mcpAdminApiKey: "",
  theme: "dark",
  provider: "gemini",
  model: "gemini-2.5-flash",
  ollamaUrl: "http://localhost:11434",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const decrypted = decryptData(raw);
    return { ...defaultSettings, ...JSON.parse(decrypted) };
  } catch (e) {
    console.error("Failed to load settings", e);
    return defaultSettings;
  }
}

export function saveSettings(settings: Settings) {
  try {
    const encrypted = encryptData(JSON.stringify(settings));
    localStorage.setItem(SETTINGS_KEY, encrypted);
  } catch (e) {
    console.error("Failed to save settings", e);
  }
}

export function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load sessions", e);
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error("Failed to save sessions", e);
  }
}
