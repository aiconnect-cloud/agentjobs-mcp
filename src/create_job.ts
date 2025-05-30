import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import axios from 'axios';
import { config } from './config.js';

// Schema for the target_channel object
const targetChannelSchema = z
  .object({
    org_id: z.string().optional().describe('Organization ID for the target channel. If not provided, uses the default organization.'),
    platform: z
      .enum(['whatsapp', 'slack', 'web'])
      .describe('Platform of the target channel.'),
    type: z.string().describe('Type of the target channel (e.g., channel).'),
    code: z.string().describe('Code/identifier for the target channel.'),
    data: z
      .record(z.any())
      .optional()
      .describe('Additional platform-specific data for the channel.')
  })
  .describe('Defines the target channel for the job.');

// Schema for the config object
const configSchema = z
  .object({
    max_follow_ups: z
      .number()
      .int()
      .optional()
      .describe('Maximum number of follow-ups allowed.'),
    max_task_retries: z
      .number()
      .int()
      .optional()
      .describe('Maximum number of retries for a task.'),
    task_retry_interval: z
      .number()
      .int()
      .optional()
      .describe('Interval in minutes between task retries.'),
    start_prompt: z.string().describe('The initial prompt to start the job.'),
    max_time_to_complete: z
      .number()
      .int()
      .optional()
      .describe('Maximum time in minutes for the job to complete.'),
    profile_id: z.string().describe('Profile ID to be used for the job.')
  })
  .describe('Configuration settings for the job.');

export default (server: McpServer) => {
  server.tool(
    'create_job',
    'Creates a new agent job.',
    {
      target_channel: targetChannelSchema,
      job_type_id: z.string().describe('The ID of the job type.'),
      config: configSchema.optional(),
      params: z
        .record(z.any())
        .optional()
        .describe('Arbitrary parameters for the job.'),
      scheduled_at: z
        .string()
        .datetime({ message: 'Invalid datetime string. Must be ISO 8601' })
        .optional()
        .describe('Optional ISO 8601 date string for scheduling the job.'),
      delay: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe(
          'Optional maximum random delay in minutes to add to the scheduled time (query parameter).'
        )
    },
    async (toolParams) => {
      const apiUrl = config.AICONNECT_API_URL;
      const apiKey = config.AICONNECT_API_KEY;
      const defaultOrgId = config.DEFAULT_ORG_ID;

      if (!apiUrl) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: API URL is not configured. Please set AICONNECT_API_URL environment variable.'
            }
          ]
        };
      }

      if (!apiKey) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: API Key is not configured. Please set AICONNECT_API_KEY environment variable.'
            }
          ]
        };
      }

      // Use default org_id if not provided
      if (!toolParams.target_channel.org_id && defaultOrgId) {
        toolParams.target_channel.org_id = defaultOrgId;
      } else if (!toolParams.target_channel.org_id && !defaultOrgId) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Organization ID is required. Please provide org_id or set DEFAULT_ORG_ID environment variable.'
            }
          ]
        };
      }

      const endpoint = `${apiUrl}/services/agent-jobs`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };

      // Separate delay as it's a query parameter
      const { delay, ...bodyPayload } = toolParams;

      const queryParams: Record<string, any> = {};
      if (delay !== undefined) {
        queryParams.delay = delay;
      }

      try {
        const response = await axios.post(endpoint, bodyPayload, {
          headers,
          params: queryParams
        });

        // API returns job details under 'data' key
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      } catch (error: any) {
        let errorMessage = `Failed to create job.`;
        if (axios.isAxiosError(error) && error.response) {
          const apiError =
            error.response.data?.message ||
            error.response.data?.error ||
            JSON.stringify(error.response.data);
          errorMessage = `API Error (${error.response.status}): ${
            apiError || error.message
          }`;
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
