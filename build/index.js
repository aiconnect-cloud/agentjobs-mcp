#!/usr/bin/env node
import * as dotenv from 'dotenv';
dotenv.config();
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import cancel_job from "./cancel_job.js";
import get_job from "./get_job.js";
import list_jobs from "./list_jobs.js";
import create_job from "./create_job.js";
// Initialize server
const server = new McpServer({
    name: "agentejobs-mcp",
    version: "1.0.0"
});
// === Start server with stdio transport ===
// Initialize the cancel_job component
cancel_job(server);
get_job(server); // Initialize the get_job component
list_jobs(server); // Initialize the list_jobs component
create_job(server); // Initialize the create_job component
const transport = new StdioServerTransport();
await server.connect(transport);
