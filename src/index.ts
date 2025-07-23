#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config();

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Get package version
const packageJson = JSON.parse(
  await import('fs').then(fs => fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
);

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

// Initialize server
const server = new McpServer({
  name: "agentjobs-mcp",
  version: packageJson.version
});

// Dynamically load and register tools
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolsDir = path.join(__dirname, 'tools');

try {
  const toolFiles = await fs.readdir(toolsDir);

  for (const file of toolFiles) {
    if (file.endsWith('.js')) { // In production, files will be .js
      const toolModule = await import(`./tools/${file}`);
      if (typeof toolModule.default === 'function') {
        toolModule.default(server);
        console.error(`-> Registered tool: ${file}`);
      }
    }
  }
} catch (error) {
    console.error("Error loading tools:", error);
    process.exit(1);
}

// Start server with stdio transport
const transport = new StdioServerTransport();

console.error(`Starting AI Connect Agent Jobs MCP Server v${packageJson.version}...`);
console.error('Server ready and listening for MCP connections');

await server.connect(transport);
