#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config();
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { InitializeRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
// Get package version
const packageJson = JSON.parse(await import('fs').then(fs => fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')));
// CLI argument parsing
const args = process.argv.slice(2);
// Help text
const helpText = `
AI Connect Agent Jobs MCP Server v${packageJson.version}
${packageJson.description}

USAGE:
  npx @aiconnect/agentjobs-mcp [OPTIONS]

OPTIONS:
  --help, -h          Show this help message
  --version, -v       Show version information
  --config, -c        Show current configuration
  --stdio             Start MCP server with stdio transport (default)

EXAMPLES:
  npx @aiconnect/agentjobs-mcp              # Start MCP server
  npx @aiconnect/agentjobs-mcp --help       # Show help
  npx @aiconnect/agentjobs-mcp --version    # Show version
  npx @aiconnect/agentjobs-mcp --config     # Show configuration

ENVIRONMENT VARIABLES:
  AICONNECT_API_URL    API endpoint URL (required)
  AICONNECT_API_KEY    API authentication key (required)

For more information, visit: ${packageJson.homepage}
Author: ${packageJson.author}
`;
// Handle CLI arguments
if (args.includes('--help') || args.includes('-h')) {
    console.log(helpText);
    process.exit(0);
}
if (args.includes('--version') || args.includes('-v')) {
    console.log(`v${packageJson.version}`);
    process.exit(0);
}
if (args.includes('--config') || args.includes('-c')) {
    console.log('Current Configuration:');
    console.log(`  API URL: ${process.env.AICONNECT_API_URL || 'Not set'}`);
    console.log(`  API Key: ${process.env.AICONNECT_API_KEY ? '[SET]' : 'Not set'}`);
    console.log(`  Node Version: ${process.version}`);
    console.log(`  MCP Server Version: ${packageJson.version}`);
    process.exit(0);
}
// Protocol version tracking
let clientProtocolVersion = "2024-11-05"; // Default fallback
let serverCapabilities = {
    tools: { listChanged: true },
    resources: {},
    prompts: {}
};
// Initialize server with dynamic capabilities based on protocol version
const server = new McpServer({
    name: "agentjobs-mcp",
    version: packageJson.version
}, {
    capabilities: serverCapabilities
});
console.error(`[DEBUG] MCP Server initialized with name: agentjobs-mcp`);
console.error(`[DEBUG] Server version: ${packageJson.version}`);
console.error(`[DEBUG] Default capabilities: tools, resources, prompts`);
// Intercept initialization to detect protocol version
const originalSetRequestHandler = server.server.setRequestHandler.bind(server.server);
// Override initialization handler to capture protocol version
server.server.setRequestHandler(InitializeRequestSchema, async (request) => {
    const initParams = request.params;
    clientProtocolVersion = initParams.protocolVersion || "2024-11-05";
    console.error(`[VERSION-NEGOTIATION] Client requested protocol: ${clientProtocolVersion}`);
    // Always use minimal capabilities to prevent loops
    console.error(`[VERSION-NEGOTIATION] Client requested: ${clientProtocolVersion}`);
    console.error(`[VERSION-NEGOTIATION] Using minimal capabilities to prevent infinite loops`);
    // Use only tools capability - no resources/prompts to avoid repeated calls
    serverCapabilities = {
        tools: {}
    };
    console.error(`[VERSION-NEGOTIATION] Responding with our supported version: 2025-03-26`);
    console.error(`[VERSION-NEGOTIATION] Updated capabilities:`, JSON.stringify(serverCapabilities, null, 2));
    // Return initialization response with our supported version
    return {
        protocolVersion: "2025-03-26", // Our SDK version
        capabilities: serverCapabilities,
        serverInfo: {
            name: "agentjobs-mcp",
            version: packageJson.version
        }
    };
});
// Dynamically load and register tools
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolsDir = path.join(__dirname, 'tools');
try {
    const toolFiles = await fs.readdir(toolsDir);
    for (const file of toolFiles) {
        if (file.endsWith('.js')) { // In production, files will be .js
            try {
                const toolModule = await import(`./tools/${file}`);
                if (typeof toolModule.default === 'function') {
                    toolModule.default(server);
                    console.error(`-> Registered tool: ${file}`);
                }
            }
            catch (error) {
                console.error(`-> Failed to register tool ${file}:`, error);
                // Continue loading other tools
            }
        }
    }
}
catch (error) {
    console.error("Error loading tools:", error);
    process.exit(1);
}
console.error(`[DEBUG] Only tools capability enabled - no resources/prompts handlers needed`);
// Start server with stdio transport
const transport = new StdioServerTransport();
console.error(`Starting AI Connect Agent Jobs MCP Server v${packageJson.version}...`);
console.error('Configuration:');
console.error(`  API URL: ${process.env.AICONNECT_API_URL || 'Using default'}`);
console.error(`  API Key: ${process.env.AICONNECT_API_KEY ? '[SET]' : '[NOT SET]'}`);
console.error(`  Default Org: ${process.env.DEFAULT_ORG_ID || 'aiconnect'}`);
console.error('Server ready and listening for MCP connections');
// Add error handling for the server connection
try {
    await server.connect(transport);
}
catch (error) {
    console.error('Error connecting MCP server:', error);
    process.exit(1);
}
