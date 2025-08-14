#!/usr/bin/env node
import * as dotenv from 'dotenv';
// Load debug environment
dotenv.config({ path: '.env.debug' });

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Test specific tools
async function testTools() {
  console.log('🧪 Testing MCP Tools...\n');

  // Initialize server
  const server = new McpServer({
    name: 'agentjobs-mcp-test',
    version: 'test'
  });

  // Load tools
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const toolsDir = path.join(__dirname, 'tools');

  try {
    const toolFiles = await fs.readdir(toolsDir);
    console.log(`📁 Found ${toolFiles.length} tool files`);

    for (const file of toolFiles) {
      if (file.endsWith('.js')) {
        try {
          console.log(`⚙️  Loading tool: ${file}`);
          const toolModule = await import(`./tools/${file}`);

          if (typeof toolModule.default === 'function') {
            toolModule.default(server);
            console.log(`✅ Successfully registered: ${file}`);
          } else {
            console.log(`❌ Invalid tool format: ${file}`);
          }
        } catch (error: any) {
          console.log(`❌ Error loading ${file}:`, error?.message || error);
        }
      }
    }

    // Show success message
    console.log('\n✅ Tool testing completed!');
    console.log('💡 To run in debug mode: MCP_DEBUG=true npm run debug');
  } catch (error) {
    console.error('❌ Error during tool testing:', error);
  }
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testTools().catch(console.error);
}

export { testTools };
