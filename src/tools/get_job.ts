import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import agentJobsClient from '../lib/agentJobsClient.js';
import { formatJobDetails } from '../utils/formatters.js';
import { mcpDebugger, withTiming } from '../utils/debugger.js';

export default (server: McpServer) => {
  server.registerTool(
    'get_job',
    {
      description: 'Retrieves an agent job by its ID.',
      annotations: {
        title: 'Get Agent Job'
      },
      inputSchema: {
        job_id: z.string({
          description:
            "The unique identifier of the job you want to retrieve. Example: 'job-12345'."
        }),
        org_id: z
          .string({
            description: "The organization ID. Example: 'aiconnect'."
          })
          .optional()
      }
    },
    async (params) => {
      mcpDebugger.toolCall("get_job", params);

      const { job_id } = params;
      const endpoint = `/services/agent-jobs/${job_id}${params.org_id ? `?org_id=${params.org_id}` : ''}`;

      mcpDebugger.debug("Built endpoint", { endpoint, job_id, org_id: params.org_id });

      try {
        const job = await withTiming(
          () => agentJobsClient.get(endpoint),
          "get_job API call"
        );

        mcpDebugger.debug("Raw API response", { job });

        const result = {
          content: [
            {
              type: 'text' as const,
              text: formatJobDetails(job)
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
