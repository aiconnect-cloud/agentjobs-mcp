import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import agentJobsClient from '../lib/agentJobsClient.js';
import { config } from '../config.js';
import { flexibleDateTimeSchema } from '../utils/schemas.js';
import { mcpDebugger, withTiming } from '../utils/debugger.js';

export default (server: McpServer) => {
  server.registerTool(
    'create_job',
    {
      description: 'Create a new Agent Job with the minimal set of fields.',
      annotations: {
        title: 'Create Agent Job'
      },
      inputSchema: {
        // Required fields
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
        scheduled_at: flexibleDateTimeSchema
          .optional()
          .describe('Schedule the job to run later')
      }
    },
    async (params) => {
      mcpDebugger.toolCall("create_job", params);

      // Fall back to default org if none supplied.
      params.target_channel.org_id ??= config.DEFAULT_ORG_ID;

      mcpDebugger.debug("Job creation payload", {
        job_type_id: params.job_type_id,
        target_channel: params.target_channel,
        scheduled_at: params.scheduled_at,
        paramsCount: params.params ? Object.keys(params.params).length : 0
      });

      try {
        const res = await withTiming(
          () => agentJobsClient.post('/services/agent-jobs', params),
          "create_job API call"
        );

        const jobId = res.id ?? 'unknown';

        mcpDebugger.debug("Job creation response", { jobId, fullResponse: res });

        const result = {
          content: [
            {
              type: 'text' as const,
              text: `✅ Job created (id: ${jobId}).`
            }
          ]
        };

        mcpDebugger.toolResponse("create_job", { jobId });

        return result;
      } catch (error: any) {
        mcpDebugger.toolError("create_job", error);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error creating job: ${error.message}`
            }
          ]
        };
      }
    }
  );
};
