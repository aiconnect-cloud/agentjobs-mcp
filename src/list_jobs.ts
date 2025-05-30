import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios from 'axios';
import { config } from './config.js';

// Define the schema for job status based on docs/agent-jobs-api.md:246-251
const jobStatusSchema = z.enum([
  "waiting",
  "scheduled",
  "running",
  "completed",
  "failed",
  "canceled"
]);

export default (server: McpServer) => {
  server.tool(
    "list_jobs",
    "Retrieves a list of agent jobs, with optional filters and pagination.",
    {
      org_id: z.string().optional().describe("Filter by organization ID. If not provided, uses the default organization."),
      status: jobStatusSchema.optional().describe("Filter by job status."),
      scheduled_at: z.string().datetime().optional().describe("Filter by exact scheduled time (ISO 8601)."),
      scheduled_at_gte: z.string().datetime().optional().describe("Filter by scheduled time greater than or equal to (ISO 8601)."),
      scheduled_at_lte: z.string().datetime().optional().describe("Filter by scheduled time less than or equal to (ISO 8601)."),
      created_at_gte: z.string().datetime().optional().describe("Filter by creation time greater than or equal to (ISO 8601)."),
      created_at_lte: z.string().datetime().optional().describe("Filter by creation time less than or equal to (ISO 8601)."),
      job_type_id: z.string().optional().describe("Filter by job type ID."),
      channel_code: z.string().optional().describe("Filter by channel code."),
      limit: z.number().int().positive().optional().describe("Maximum number of jobs to return."),
      offset: z.number().int().nonnegative().optional().describe("Number of jobs to skip (for pagination)."),
      sort: z.string().optional().describe("Sorting field and direction (e.g., created_at:desc)."),
    },
    async (params) => {
      const apiUrl = config.AICONNECT_API_URL;
      const apiKey = config.AICONNECT_API_KEY;

      if (!apiUrl) {
        return {
          content: [{
            type: "text",
            text: "Error: API URL is not configured. Please set AICONNECT_API_URL environment variable."
          }]
        };
      }

      if (!apiKey) {
        return {
          content: [{
            type: "text",
            text: "Error: API Key is not configured. Please set AICONNECT_API_KEY environment variable."
          }]
        };
      }

      const endpoint = `${apiUrl}/services/agent-jobs`;
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${apiKey}`,
      };

      // Build query parameters object from provided params
      const queryParams: Record<string, any> = {};
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          queryParams[key] = value;
        }
      }

      try {
        const response = await axios.get(endpoint, {
          headers,
          params: queryParams, // Axios uses 'params' for query parameters in GET requests
        });

        // Return the data part of the response, stringified as JSON text
        // API docs show jobs under 'data' key, and meta for pagination
        return {
          content: [{
            type: "text",
            text: JSON.stringify(response.data, null, 2), 
          }]
        };
      } catch (error: any) {
        let errorMessage = `Failed to list jobs.`;
        if (axios.isAxiosError(error) && error.response) {
          const apiError = error.response.data?.message || error.response.data?.error || JSON.stringify(error.response.data);
          errorMessage = `API Error (${error.response.status}): ${apiError || error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `Error: ${error.message}`;
        }
        return {
          content: [{
            type: "text",
            text: errorMessage,
          }]
        };
      }
    }
  );
}