import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import agentJobsClient from '../lib/agentJobsClient.js';
import { formatJobDetails } from '../utils/formatters.js';
import { mcpDebugger, withTiming } from '../utils/debugger.js';

const ACTIVITIES_SORT_VALUES = ['created_at', '-created_at'] as const;

export default (server: McpServer) => {
  server.registerTool(
    'get_job',
    {
      description: 'Retrieves an agent job by its ID. Optionally includes recent activity records as an inline overlay (use include_activities=true).',
      annotations: {
        title: 'Get Agent Job'
      },
      inputSchema: {
        job_id: z.string({
          description:
            "The unique identifier of the job you want to retrieve. Example: 'job-12345'."
        }).min(1, { message: 'job_id must be a non-empty string' }),
        org_id: z
          .string({
            description: "The organization ID. Example: 'aiconnect'."
          })
          .optional(),
        include_activities: z.boolean().optional().describe(
          "When true, attaches recent activities as an overlay (?include=activities). For full pagination of activities use the get_job_activities tool."
        ),
        include_limit: z.number().int().optional().describe(
          "Max activities to attach when include_activities=true. Range 1-100, default 50. Silently ignored when include_activities is false/omitted."
        ),
        include_sort: z.string().optional().describe(
          "Sort order for attached activities when include_activities=true. 'created_at' or '-created_at' (default). Silently ignored when include_activities is false/omitted."
        )
      }
    },
    async (params) => {
      mcpDebugger.toolCall("get_job", params);

      const { job_id, include_activities } = params;
      const endpoint = `/services/agent-jobs/${job_id}`;

      const queryParams: Record<string, any> = {};
      if (params.org_id) queryParams.org_id = params.org_id;
      if (include_activities) {
        // Per spec, range/enum on the overlay-only params are validated here
        // (not in the Zod input schema) so that flag-off callers carrying stale
        // configuration are silently tolerated. With the flag on, invalid
        // values short-circuit before any HTTP call.
        if (params.include_limit !== undefined) {
          if (!Number.isInteger(params.include_limit) || params.include_limit < 1 || params.include_limit > 100) {
            return {
              content: [{ type: 'text' as const, text: 'Error getting job: include_limit must be an integer in [1, 100]' }],
            };
          }
        }
        if (params.include_sort !== undefined && !(ACTIVITIES_SORT_VALUES as readonly string[]).includes(params.include_sort)) {
          return {
            content: [{ type: 'text' as const, text: "Error getting job: include_sort must be 'created_at' or '-created_at'" }],
          };
        }
        queryParams.include = 'activities';
        queryParams.include_limit = params.include_limit ?? 50;
        queryParams.include_sort = params.include_sort ?? '-created_at';
      }

      mcpDebugger.debug("Built endpoint", { endpoint, queryParams });

      try {
        const apiResponse = await withTiming(
          () => agentJobsClient.getWithMeta(endpoint, queryParams),
          "get_job API call"
        );

        const job = apiResponse?.data ?? apiResponse;
        const meta = apiResponse?.meta;

        mcpDebugger.debug("Raw API response", { job, meta });

        const result = {
          content: [
            {
              type: 'text' as const,
              text: formatJobDetails(job, meta)
            }
          ]
        };

        mcpDebugger.toolResponse("get_job", {
          jobId: job_id,
          resultLength: result.content[0].text.length
        });

        return result;
      } catch (error: any) {
        mcpDebugger.toolError("get_job", error);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error getting job: ${error.message}`
            }
          ]
        };
      }
    }
  );
};
