import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios from 'axios';
import { config } from './config.js';

export default (server: McpServer) => {
  server.tool(
    "cancel_job",
    "Cancels an agent job by its ID.",
    {
      job_id: z.string({
        description: "The ID of the job to cancel.",
      }),
      reason: z.string().optional().describe("Optional reason for cancellation."),
    },
    async (params) => {
      const { job_id, reason } = params;
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

      const endpoint = `${apiUrl}/services/agent-jobs/${job_id}`;
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${apiKey}`,
      };
      let requestBody;

      if (reason) {
        headers["Content-Type"] = "application/json";
        requestBody = { reason };
      }

      try {
        const response = await axios.delete(endpoint, {
          headers,
          data: requestBody, // axios uses 'data' for DELETE request body
        });

        // Assuming the API returns a message field on success as per docs/agent-jobs-api.md:229
        const responseMessage = response.data?.message || `Job with ID '${job_id}' successfully canceled.`;
        return {
          content: [{
            type: "text",
            text: responseMessage,
          }]
        };
      } catch (error: any) {
        let errorMessage = `Failed to cancel job ${job_id}.`;
        if (axios.isAxiosError(error) && error.response) {
          // Try to get a more specific error message from the API response
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