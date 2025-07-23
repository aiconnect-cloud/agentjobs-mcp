import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import axios from 'axios';
import { config } from '../config.js';

// Schema for the target_channel object
const targetChannelSchema = z
  .object({
    org_id: z.string().optional().describe("Organization ID. Uses default if not provided."),
    platform: z
      .enum(['whatsapp', 'slack', 'web'])
      .describe("The platform for the job, e.g., 'slack'."),
    type: z.string().describe("Type of the target, e.g., 'channel'."),
    code: z.string().describe("Identifier for the target, e.g., a Slack channel ID 'C123456'."),
    data: z
      .record(z.any())
      .optional()
      .describe("Additional platform-specific data.")
  })
  .describe('Specifies the destination channel for the job.');

// Schema for the config object
const configSchema = z
  .object({
    max_follow_ups: z.number().int().optional().describe("Max number of follow-ups."),
    max_task_retries: z.number().int().optional().describe("Max retries for a task."),
    task_retry_interval: z.number().int().optional().describe("Interval in minutes between retries."),
    start_prompt: z.string().describe("The initial prompt to execute."),
    max_time_to_complete: z.number().int().optional().describe("Max time in minutes for job completion."),
    profile_id: z.string().describe("Profile ID to use for the job execution.")
  })
  .describe('Defines the execution settings for the job.');

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

        const createdJob = response.data?.data || response.data;
        return {
          content: [{
            type: "text",
            text: `Successfully created job with ID '${createdJob.id}'.`,
          }],
          metadata: {
            job: createdJob,
          }
        };
      } catch (error: any) {
        let errorMessage = `Failed to create job.`;
        let errorDetails = {};

        if (axios.isAxiosError(error) && error.response) {
          const apiError =
            error.response.data?.message ||
            error.response.data?.error ||
            JSON.stringify(error.response.data);
          errorMessage = `API Error (${error.response.status}): ${
            apiError || error.message
          }`;
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
          metadata: {
            error: "Failed to create job",
            details: errorDetails
          }
        };
      }
    }
  );
};