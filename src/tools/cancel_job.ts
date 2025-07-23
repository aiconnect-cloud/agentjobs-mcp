import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios from 'axios';
import { config } from '../config.js';

export default (server: McpServer) => {
  server.tool(
    "cancel_job",
    "Cancels an agent job by its ID.",
    {
      job_id: z.string({
        description: "The unique identifier of the job to be canceled. Example: 'job-12345'.",
      }),
      reason: z.string().optional().describe("An optional reason explaining why the job is being canceled."),
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

        const responseMessage = response.data?.message || `Job with ID '${job_id}' successfully canceled.`;
        return {
          content: [{
            type: "text",
            text: responseMessage,
          }],
          structuredContent: {
            job_id,
            status: "canceled",
            details: response.data,
          }
        };
      } catch (error: any) {
        let errorMessage = `Failed to cancel job ${job_id}.`;
        let errorDetails = {};

        if (axios.isAxiosError(error) && error.response) {
          const apiError = error.response.data?.message || error.response.data?.error || JSON.stringify(error.response.data);
          errorMessage = `API Error (${error.response.status}): ${apiError || error.message}`;
          errorDetails = {
            status: error.response.status,
            data: error.response.data
          };
        } else if (error instanceof Error) {
          errorMessage = `Error: ${error.message}`;
        }
        
        return {
          content: [{
            type: "text",
            text: errorMessage,
          }],
          structuredContent: {
            error: `Failed to cancel job`,
            job_id,
            details: errorDetails
          }
        };
      }
    }
  );
}