# MCP Admin Chrome Extension
<img width="1841" height="1062" alt="image" src="https://github.com/user-attachments/assets/09536a88-4299-44d8-9771-60a7b4aaff6d" />

Welcome to the MCP Admin Chrome Extension! This powerful tool allows you to connect directly to your managed Model Context Protocol (MCP) servers and interact with them using advanced LLMs (Gemini, OpenAI, or local Ollama models) right from your browser's side panel.

## 🚀 Installation Guide

Since this is a custom-packed Chrome Extension, you'll need to install it manually using Chrome's Developer Mode.

1. **Download the Package:**
   Download the `final_extension.zip` file located in the root folder of this project to your local computer.
2. **Extract the Files:**
   Unzip `final_extension.zip` into a folder on your computer.
3. **Open Chrome Extensions:**
   In your Google Chrome browser, type `chrome://extensions/` into the URL bar and hit Enter.
4. **Enable Developer Mode:**
   Toggle the **Developer mode** switch in the top right corner of the Extensions page so that it is turned **ON**.
5. **Load the Extension:**
   Click the **Load unpacked** button that appears in the top left corner.
   Select the unzipped `final_extension` folder from step 2.

The **MCP Admin Plugin** should now appear in your list of extensions! You can pin it to your toolbar by clicking the puzzle piece icon next to your profile avatar and clicking the pin icon.

---

## ⚙️ Initial Setup

When you first open the extension, you'll see a "Setup Required" screen. Follow these steps to get connected:

1. Click **Open Settings**.
2. **MCP Admin Connection:** 
   Enter your **MCP Admin API Key** (Bearer token). Click the **Test** button next to it. A green checkmark will confirm that you are successfully connected to your MCP backend.
3. **LLM Configuration:**
   * Select your preferred provider using the **Gemini**, **OpenAI**, or **Ollama** tabs.
   * Enter the corresponding API Key for Gemini/OpenAI, or the Base URL for Ollama (defaults to `http://localhost:11434`).
   * Click **Refresh** next to the Model dropdown to load the latest available chat models, and select the one you wish to use (e.g., `gemini-2.5-flash`, `gpt-4o-mini`, or `llama3.2`).
4. **Theme (Optional):** Select Light or Dark mode.
5. Click **Save Settings**.

---

## 💬 How to Use

Once configured, the main chat interface will unlock.

* **Select an MCP Server:** At the top of the chat window, use the dropdown menu to select which of your deployed MCP servers you want to interact with. (Use the refresh icon to pull the latest list from your Admin API).
* **Transport:** Ensure the transport method (e.g., `sse`) is correctly selected for your server.
* **Chatting:** Type a message into the chat box. The LLM will automatically evaluate your request, review the MCP tools available on the selected server, and execute them natively in the background to assist you!
* **Manage Sessions:** Use the sidebar to create new chat threads, switch between historical conversations, or export a chat log to Markdown.

## 🔒 Privacy & Data
This extension runs completely on your local client (in your browser). It communicates directly with the Google Gemini / OpenAI APIs and your MCP Admin API. No intermediate proxy servers are used, keeping your API keys securely stored within your local Chrome browser storage.
