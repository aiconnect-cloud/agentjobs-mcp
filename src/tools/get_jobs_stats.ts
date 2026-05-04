import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import agentJobsClient from "../lib/agentJobsClient.js";
import { formatJobStats } from "../utils/formatters.js";
import { flexibleDateTimeSchema } from "../utils/schemas.js";
import { mcpDebugger, withTiming } from "../utils/debugger.js";

export default (server: McpServer) => {
  server.registerTool(
    "get_jobs_stats",
    {
      description: "Returns aggregated job counts broken down by status (waiting/scheduled/running/completed/failed/canceled) plus a summary (total, success rate, active, completion rate). To filter to a single status, use `list_jobs` with `status=` instead — this tool intentionally does not expose a `status` filter because the upstream stats endpoint ignores it (the breakdown is itself by status). Filters available here narrow the universe along orthogonal dimensions: `job_type_id`, `channel_code`, `tags`, `scheduled_at_*`, `created_at_*`. Result-code and duration aggregates are not yet available; for those today, fall back to `list_jobs` and aggregate client-side. Optimized for dashboards and monitoring with minimal network overhead.",
      annotations: {
        title: "Get Job Statistics"
      },
      inputSchema: {
        org_id: z.string().optional().describe("Filter by organization ID."),
        scheduled_at_gte: flexibleDateTimeSchema().optional().describe("Start of period (ISO 8601)"),
        scheduled_at_lte: flexibleDateTimeSchema().optional().describe("End of period (ISO 8601)"),
        created_at_gte: flexibleDateTimeSchema().optional().describe("Filter for jobs created at or after a specific time (ISO 8601)."),
        created_at_lte: flexibleDateTimeSchema().optional().describe("Filter for jobs created at or before a specific time (ISO 8601)."),
        job_type_id: z.string().optional().describe("Job type filter"),
        channel_code: z.string().optional().describe("Channel filter"),
        tags: z.string().optional().describe("Tags filter (comma-separated)"),
      }
    },
    async (params) => {
      mcpDebugger.toolCall("get_jobs_stats", params);

      try {
        const response = await withTiming(
          () => agentJobsClient.getStats(params),
          "get_jobs_stats API call"
        );

        const stats = response.meta?.stats || {};

        mcpDebugger.debug("Raw API response", { stats, appliedFilters: params });

        const result = {
          content: [{
            type: "text" as const,
            text: formatJobStats(stats, params),
          }]
        };

        mcpDebugger.toolResponse("get_jobs_stats", result);
        return result;
      } catch (error: any) {
        mcpDebugger.toolError("get_jobs_stats", error);

        return {
          content: [{
            type: "text" as const,
            text: `Error getting job stats: ${error.message}`,
          }],
        };
      }
    }
  );
}
