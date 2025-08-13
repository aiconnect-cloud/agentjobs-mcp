import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import agentJobsClient from '../lib/agentJobsClient.js';
import { config } from '../config.js';
import { formatJobTypeDetails } from '../utils/formatters.js';
import { mcpDebugger, withTiming } from '../utils/debugger.js';

export default (server: McpServer) => {
  server.registerTool(
    'get_job_type',
    {
      description: 'Retrieves an agent job type by its ID.',
      annotations: {
        title: 'Get Job Type Configuration'
      },
      inputSchema: {
        job_type_id: z.string({
          description:
            "The unique identifier of the job type you want to retrieve. Example: 'mood-monitor'."
        }),
        org_id: z.string({
          description: "The organization ID. Example: 'aiconnect'."
        }).optional()
      }
    },
    async (params) => {
      mcpDebugger.toolCall("get_job_type", params);

      const { job_type_id } = params;
      const org_id = params.org_id || config.DEFAULT_ORG_ID;
      const endpoint = `/organizations/${org_id}/agent-jobs-type/${job_type_id}`;

      mcpDebugger.debug("Job type request", {
        endpoint,
        job_type_id,
        org_id,
        usingDefaultOrg: !params.org_id
      });

      try {
        const jobType = await withTiming(
          () => agentJobsClient.get(endpoint),
          "get_job_type API call"
        );

        mcpDebugger.debug("Job type response", { jobType });

        const result = {
          content: [
            {
              type: 'text' as const,
              text: formatJobTypeDetails(jobType)
            }
          ]
        };

        mcpDebugger.toolResponse("get_job_type", {
          job_type_id,
          org_id,
          resultLength: result.content[0].text.length
        });

        return result;
      } catch (error: any) {
        mcpDebugger.toolError("get_job_type", error);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error getting job type: ${error.message}`
            }
          ]
        };
      }
    }
  );
};
