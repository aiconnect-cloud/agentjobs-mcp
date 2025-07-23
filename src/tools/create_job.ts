import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import axios from 'axios';
import { config } from '../config.js';

/**
 * Lightweight Agent‑Jobs creator.
 * Only the essentials are required to keep the contract LLM‑friendly.
 */
export default (server: McpServer) => {
  server.tool(
    'create_job',
    'Create a new Agent Job with the minimal set of fields.',
    {
      // ─────────────────────────────────────────────────────────────────────────┐
      // Required
      // ─────────────────────────────────────────────────────────────────────────┘
      job_type_id: z
        .string()
        .describe('ID of the job type (e.g. "mood-monitor")'),

      target_channel: z
        .object({
          platform: z
            .enum(['whatsapp', 'slack', 'web'])
            .describe('Destination platform.'),
          code: z
            .string()
            .describe('Channel identifier, phone number, or user ID.'),
          org_id: z
            .string()
            .optional()
            .describe('Org ID – defaults to config.DEFAULT_ORG_ID')
        })
        .describe('Where the agent will communicate.'),

      params: z
        .record(z.any())
        .optional()
        .describe('Free‑form params passed to the agent'),
      scheduled_at: z
        .string()
        .datetime({ message: 'Use ISO‑8601' })
        .optional()
        .describe('Schedule the job to run later')
    },

    // ───────────────────────────────────────────────────────────────────────────┐
    // Implementation                                                             │
    // ───────────────────────────────────────────────────────────────────────────┘
    async (params) => {
      const {
        AICONNECT_API_URL: apiUrl,
        AICONNECT_API_KEY: apiKey,
        DEFAULT_ORG_ID
      } = config;

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

      // Fall back to default org if none supplied.
      params.target_channel.org_id ??= DEFAULT_ORG_ID;

      try {
        const res = await axios.post(`${apiUrl}/services/agent-jobs`, params, {
          headers: { Authorization: `Bearer ${apiKey}` }
        });

        const jobId = res.data?.data?.id ?? res.data?.id ?? 'unknown';
        return {
          content: [
            {
              type: 'text',
              text: `✅ Job created (id: ${jobId}).`
            }
          ]
        };
      } catch (error: any) {
        let errorMessage = `Failed to create job.`;
        if (axios.isAxiosError(error) && error.response) {
          const apiError = error.response.data?.message || error.response.data?.error || JSON.stringify(error.response.data);
          errorMessage = `API Error (${error.response.status}): ${apiError || error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `Error: ${error.message}`;
        }

        return {
          content: [
            {
              type: 'text',
              text: errorMessage
            }
          ]
        };
      }
    }
  );
};
