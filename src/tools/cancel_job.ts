import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import agentJobsClient from "../lib/agentJobsClient.js";
import { formatJobSummary } from '../utils/formatters.js';
import { mcpDebugger, withTiming } from '../utils/debugger.js';

export default (server: McpServer) => {
  server.registerTool(
    "cancel_job",
    {
      description: "Cancels an agent job by its ID.",
      annotations: {
        title: "Cancel Agent Job"
      },
      inputSchema: {
        job_id: z.string({
          description: "The unique identifier of the job to be canceled. Example: 'job-12345'.",
        }),
        reason: z.string().optional().describe("An optional reason explaining why the job is being canceled."),
      }
    },
    async (params) => {
      mcpDebugger.toolCall("cancel_job", params);

      const { job_id, reason } = params;
      const endpoint = `/services/agent-jobs/${job_id}`;
      let requestBody: { reason: string } | undefined;

      if (reason) {
        requestBody = { reason };
      }

      mcpDebugger.debug("Job cancellation request", {
        endpoint,
        job_id,
        reason,
        hasRequestBody: !!requestBody
      });

      try {
        const canceledJob = await withTiming(
          () => agentJobsClient.delete(endpoint, requestBody),
          "cancel_job API call"
        );

        mcpDebugger.debug("Job cancellation response", { canceledJob });

        const summary = formatJobSummary(canceledJob);

        const result = {
          content: [{
            type: "text" as const,
            text: `Successfully canceled job:\n\n${summary}`,
          }]
        };

        mcpDebugger.toolResponse("cancel_job", {
          jobId: job_id,
          reason,
          resultLength: result.content[0].text.length
        });

        return result;
      } catch (error: any) {
        mcpDebugger.toolError("cancel_job", error);

        return {
          content: [{
            type: "text" as const,
            text: `Error canceling job: ${error.message}`,
          }],
        };
      }
    }
  );
}
