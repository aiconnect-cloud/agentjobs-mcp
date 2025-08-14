import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import agentJobsClient from "../lib/agentJobsClient.js";
import { formatJobList } from "../utils/formatters.js";
import { flexibleDateTimeSchema } from "../utils/schemas.js";
import { mcpDebugger, withTiming } from "../utils/debugger.js";

// Define the schema for job status based on docs/agent-jobs-api.md:246-251
const jobStatusSchema = z.enum([
  "waiting",
  "scheduled",
  "running",
  "completed",
  "failed",
  "canceled"
]);

export default (server: McpServer) => {
  server.registerTool(
    "list_jobs",
    {
      description: "Retrieves a list of agent jobs, with optional filters and pagination.",
      annotations: {
        title: "List Agent Jobs"
      },
      inputSchema: {
        org_id: z.string().optional().describe("Filter by organization ID. If not provided, the default from the environment is used."),
        status: jobStatusSchema.optional().describe("Filter by job status. Possible values are: 'waiting', 'scheduled', 'running', 'completed', 'failed', 'canceled'."),
        scheduled_at: flexibleDateTimeSchema.optional().describe("Filter by the exact scheduled time in ISO 8601 format (e.g., '2024-07-23T10:00:00Z')."),
        scheduled_at_gte: flexibleDateTimeSchema.optional().describe("Filter for jobs scheduled at or after a specific time (ISO 8601)."),
        scheduled_at_lte: flexibleDateTimeSchema.optional().describe("Filter for jobs scheduled at or before a specific time (ISO 8601)."),
        created_at_gte: flexibleDateTimeSchema.optional().describe("Filter for jobs created at or after a specific time (ISO 8601)."),
        created_at_lte: flexibleDateTimeSchema.optional().describe("Filter for jobs created at or before a specific time (ISO 8601)."),
        job_type_id: z.string().optional().describe("Filter by the specific job type ID (e.g., 'daily-report')."),
        channel_code: z.string().optional().describe("Filter by the channel code (e.g., 'C123456' for a Slack channel)."),
        limit: z.number().int().positive().optional().describe("Maximum number of jobs to return (e.g.,20). Default is 20."),
        offset: z.number().int().nonnegative().optional().describe("Number of jobs to skip, used for pagination. Default is 0."),
        sort: z.string().optional().describe("Field to sort by and direction. Format is 'field:direction'. Example: 'created_at:desc'.")
      }
    },
    async (params) => {
      mcpDebugger.toolCall("list_jobs", params);

      const endpoint = `/services/agent-jobs`;

      // Build query parameters object from provided params
      const queryParams: Record<string, any> = {};
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          queryParams[key] = value;
        }
      }

      mcpDebugger.debug("Built query parameters", { endpoint, queryParams });

      try {
        const apiResponse = await withTiming(
          () => agentJobsClient.getWithMeta(endpoint, queryParams),
          "list_jobs API call"
        );

        // Access the full API response structure
        const jobs = apiResponse.data || [];
        const meta = apiResponse.meta || {};

        mcpDebugger.debug("Raw API response", {
          fullResponse: apiResponse,
          jobsCount: jobs.length,
          meta,
          firstJob: jobs[0] || null
        });

        const result = {
          content: [{
            type: "text" as const,
            text: formatJobList(jobs, meta),
          }]
        };

        mcpDebugger.toolResponse("list_jobs", {
          jobsReturned: jobs.length,
          resultLength: result.content[0].text.length
        });

        return result;
      } catch (error: any) {
        mcpDebugger.toolError("list_jobs", error);

        return {
          content: [{
            type: "text" as const,
            text: `Error listing jobs: ${error.message}`,
          }],
        };
      }
    }
  );
}
