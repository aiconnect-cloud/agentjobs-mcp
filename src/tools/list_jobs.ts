import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import agentJobsClient from "../lib/agentJobsClient.js";
import { formatJobList } from "../utils/formatters.js";
import { flexibleDateTimeSchema } from "../utils/schemas.js";
import { mcpDebugger, withTiming } from "../utils/debugger.js";

const ACTIVITIES_SORT_VALUES = ['created_at', '-created_at'] as const;

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
        scheduled_at: flexibleDateTimeSchema().optional().describe("Filter by the exact scheduled time in ISO 8601 format (e.g., '2024-07-23T10:00:00Z')."),
        scheduled_at_gte: flexibleDateTimeSchema().optional().describe("Filter for jobs scheduled at or after a specific time (ISO 8601)."),
        scheduled_at_lte: flexibleDateTimeSchema().optional().describe("Filter for jobs scheduled at or before a specific time (ISO 8601)."),
        created_at_gte: flexibleDateTimeSchema().optional().describe("Filter for jobs created at or after a specific time (ISO 8601)."),
        created_at_lte: flexibleDateTimeSchema().optional().describe("Filter for jobs created at or before a specific time (ISO 8601)."),
        job_type_id: z.string().optional().describe("Filter by the specific job type ID (e.g., 'daily-report')."),
        channel_code: z.string().optional().describe("Filter by the channel code (e.g., 'C123456' for a Slack channel)."),
        limit: z.number().int().positive().optional().describe("Maximum number of jobs to return (e.g.,20). Default is 20."),
        offset: z.number().int().nonnegative().optional().describe("Number of jobs to skip, used for pagination. Default is 0."),
        sort: z.string().optional().describe("Field to sort by and direction. Format is 'field:direction'. Example: 'created_at:desc'."),
        include_activities: z.boolean().optional().describe(
          "When true, attaches activities to each job in the list (?include=activities). For full pagination of a single job's activities use the get_job_activities tool."
        ),
        activities_limit_per_job: z.number().int().optional().describe(
          "Max activities per job when include_activities=true. Range 1-100, default 15. Silently ignored when include_activities is false/omitted."
        ),
        activities_total_limit: z.number().int().optional().describe(
          "Global cap on total activities returned across all jobs in the response when include_activities=true. Range 1-3000, default 500. Silently ignored when include_activities is false/omitted."
        ),
        activities_sort: z.string().optional().describe(
          "Sort order for attached activities when include_activities=true. 'created_at' or '-created_at' (default). Silently ignored when include_activities is false/omitted."
        )
      }
    },
    async (params) => {
      mcpDebugger.toolCall("list_jobs", params);

      const endpoint = `/services/agent-jobs`;

      const { include_activities, activities_limit_per_job, activities_total_limit, activities_sort, ...rest } = params;

      const queryParams: Record<string, any> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) {
          queryParams[key] = value;
        }
      }
      if (include_activities) {
        // Per spec, range/enum on the overlay-only params are validated here
        // (not in the Zod input schema) so that flag-off callers carrying stale
        // configuration are silently tolerated. With the flag on, invalid
        // values short-circuit before any HTTP call.
        if (activities_limit_per_job !== undefined) {
          if (!Number.isInteger(activities_limit_per_job) || activities_limit_per_job < 1 || activities_limit_per_job > 100) {
            return {
              content: [{ type: 'text' as const, text: 'Error listing jobs: activities_limit_per_job must be an integer in [1, 100]' }],
            };
          }
        }
        if (activities_total_limit !== undefined) {
          if (!Number.isInteger(activities_total_limit) || activities_total_limit < 1 || activities_total_limit > 3000) {
            return {
              content: [{ type: 'text' as const, text: 'Error listing jobs: activities_total_limit must be an integer in [1, 3000]' }],
            };
          }
        }
        if (activities_sort !== undefined && !(ACTIVITIES_SORT_VALUES as readonly string[]).includes(activities_sort)) {
          return {
            content: [{ type: 'text' as const, text: "Error listing jobs: activities_sort must be 'created_at' or '-created_at'" }],
          };
        }
        queryParams.include = 'activities';
        queryParams.activities_limit_per_job = activities_limit_per_job ?? 15;
        queryParams.activities_total_limit = activities_total_limit ?? 500;
        queryParams.activities_sort = activities_sort ?? '-created_at';
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

        const offset = typeof params.offset === 'number' ? params.offset : 0;

        const result = {
          content: [{
            type: "text" as const,
            text: formatJobList(jobs, meta, offset, { includeActivities: include_activities === true }),
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
