import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/**
 * Extended MCP Server that provides empty implementations for resources and prompts
 * to prevent "Method not found" errors in Claude Desktop
 */
export class ExtendedMcpServer extends McpServer {
    constructor(info) {
        super(info);
        // Add empty resource and prompt handlers after construction
        this.setupEmptyHandlers();
    }
    setupEmptyHandlers() {
        // Use the private methods to set up handlers
        try {
            this.setResourceRequestHandlers({
                list: async () => ({ resources: [] }),
                read: async () => ({ contents: [{ type: "text", text: "" }] })
            });
            this.setPromptRequestHandlers({
                list: async () => ({ prompts: [] }),
                get: async () => ({
                    description: "",
                    messages: [{ role: "user", content: { type: "text", text: "" } }]
                })
            });
        }
        catch (error) {
            console.error("Failed to set empty handlers:", error);
        }
    }
}
