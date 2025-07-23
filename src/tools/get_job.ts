import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios from 'axios';
import { config } from '../config.js';

export default (server: McpServer) => {
  server.tool(
    "get_job",
    "Retrieves an agent job by its ID.",
    {
      job_id: z.string({
        description: "The unique identifier of the job you want to retrieve. Example: 'job-12345'.",
      }),
    },
    async (params) => {
      const { job_id } = params;
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

      try {
        const response = await axios.get(endpoint, {
          headers,
        });

        const job = response.data?.data || response.data;
        return {
          content: [{
            type: "text",
            text: `Successfully retrieved job with ID '${job_id}'. Status: ${job.status}`,
          }],
          structuredContent: {
            job,
          }
        };
      } catch (error: any) {
        let errorMessage = `Failed to retrieve job ${job_id}.`;
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
            error: `Failed to retrieve job`,
            job_id,
            details: errorDetails
          }
        };
      }
    }
  );
}