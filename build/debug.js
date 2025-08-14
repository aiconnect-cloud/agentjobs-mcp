#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config();
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { config } from './config.js';
// Enable debug mode
const DEBUG = true;
function debugLog(message, data) {
    if (DEBUG) {
        const timestamp = new Date().toISOString();
        console.error(`[DEBUG ${timestamp}] ${message}`);
        if (data) {
            console.error('[DEBUG DATA]', JSON.stringify(data, null, 2));
        }
    }
}
// Get package version
const packageJson = JSON.parse(await import('fs').then(fs => fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')));
debugLog('Starting MCP Server in DEBUG mode');
debugLog('Configuration loaded', {
    DEFAULT_ORG_ID: config.DEFAULT_ORG_ID,
    AICONNECT_API_URL: config.AICONNECT_API_URL,
    AICONNECT_API_KEY: config.AICONNECT_API_KEY ? '[SET]' : '[NOT SET]',
    NODE_ENV: process.env.NODE_ENV,
    version: packageJson.version
});
// Initialize server with debug logging
const server = new McpServer({
    name: "agentjobs-mcp-debug",
    version: packageJson.version
});
debugLog('MCP Server initialized');
// Dynamically load and register tools with debug info
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolsDir = path.join(__dirname, 'tools');
try {
    debugLog(`Loading tools from: ${toolsDir}`);
    const toolFiles = await fs.readdir(toolsDir);
    debugLog(`Found tool files:`, toolFiles);
    for (const file of toolFiles) {
        if (file.endsWith('.js')) {
            debugLog(`Loading tool: ${file}`);
            try {
                const toolModule = await import(`./tools/${file}`);
                if (typeof toolModule.default === 'function') {
                    toolModule.default(server);
                    debugLog(`✅ Successfully registered tool: ${file}`);
                }
                else {
                    debugLog(`❌ Tool ${file} does not export a default function`);
                }
            }
            catch (error) {
                debugLog(`❌ Error loading tool ${file}:`, error);
            }
        }
    }
}
catch (error) {
    debugLog("❌ Error loading tools directory:", error);
    process.exit(1);
}
// Start server with debug transport
const transport = new StdioServerTransport();
debugLog('Starting transport connection...');
// Add connection event handling
transport.onclose = () => {
    debugLog('Transport connection closed');
};
transport.onerror = (error) => {
    debugLog('Transport error:', error);
};
console.error(`🔍 AI Connect Agent Jobs MCP Server v${packageJson.version} (DEBUG MODE)`);
console.error('🚀 Server ready and listening for MCP connections');
try {
    await server.connect(transport);
    debugLog('✅ Server connected successfully');
}
catch (error) {
    debugLog('❌ Error connecting MCP server:', error);
    process.exit(1);
}
