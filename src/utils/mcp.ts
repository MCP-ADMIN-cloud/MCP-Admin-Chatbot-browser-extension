import { Settings, McpTool, McpServerDef } from "../types";

const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

export async function fetchMcpServers(apiKey: string): Promise<McpServerDef[]> {
  if (!apiKey) return [];
  try {
    let res;
    if (isExtension) {
      res = await fetch("https://mcpadmin.cloud/api/mcp", {
        headers: { 
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      });
    } else {
      res = await fetch("/api/mcp/servers", {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });
    }

    if (!res.ok) throw new Error("Failed to fetch MCP servers");
    const data = await res.json();
    const allServers: McpServerDef[] = Array.isArray(data) ? data : data.data || data.servers || [];
    
    // Filter to only include deployed/active servers
    return allServers.filter(s => s.config?.isDeployed === true);
  } catch (error) {
    console.error("Failed to fetch MCP servers:", error);
    return [];
  }
}

export async function mcpRequest(apiKey: string, serverId: string, transport: string, method: string, params?: any) {
  if (!apiKey || !serverId) throw new Error("Missing MCP Admin API Key or Server ID");
  
  const url = `https://mcpadmin.cloud/api/mcp/${serverId}/${transport}?apiKey=${apiKey}`;

  let res;

  if (isExtension) {
    const rpcBody = {
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 1000000).toString(),
      method,
      params,
    };
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcBody),
    });
  } else {
    res = await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        method,
        params,
      }),
    });
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

export async function fetchMcpTools(apiKey: string, serverId: string, transport: string): Promise<McpTool[]> {
  if (!apiKey || !serverId) return [];
  try {
    await mcpRequest(apiKey, serverId, transport, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "MCPAdminExt", version: "1.0" },
    }).catch(() => {});
    
    await mcpRequest(apiKey, serverId, transport, "notifications/initialized").catch(() => {});

    const result = await mcpRequest(apiKey, serverId, transport, "tools/list");
    return result.tools || [];
  } catch (error) {
    console.error("Failed to fetch MCP tools:", error);
    return [];
  }
}

export async function callMcpTool(apiKey: string, serverId: string, transport: string, name: string, args: any) {
  return mcpRequest(apiKey, serverId, transport, "tools/call", {
    name,
    arguments: args,
  });
}
