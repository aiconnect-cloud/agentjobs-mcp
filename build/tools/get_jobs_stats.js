import { z } from "zod";
import agentJobsClient from "../lib/agentJobsClient.js";
import { formatJobStats } from "../utils/formatters.js";
import { flexibleDateTimeSchema } from "../utils/schemas.js";
import { mcpDebugger, withTiming } from "../utils/debugger.js";
const jobStatusSchema = z.enum([
    "waiting",
    "scheduled",
    "running",
    "completed",
    "failed",
    "canceled"
]);
export default (server) => {
    server.registerTool("get_jobs_stats", {
        description: "Get aggregated statistics for agent jobs without retrieving individual job data. Optimized for dashboards and monitoring with minimal network overhead.",
        annotations: {
            title: "Get Job Statistics"
        },
        inputSchema: {
            org_id: z.string().optional().describe("Filter by organization ID."),
            scheduled_at_gte: flexibleDateTimeSchema.optional().describe("Start of period (ISO 8601)"),
            scheduled_at_lte: flexibleDateTimeSchema.optional().describe("End of period (ISO 8601)"),
            created_at_gte: flexibleDateTimeSchema.optional().describe("Filter for jobs created at or after a specific time (ISO 8601)."),
            created_at_lte: flexibleDateTimeSchema.optional().describe("Filter for jobs created at or before a specific time (ISO 8601)."),
            job_type_id: z.string().optional().describe("Job type filter"),
            channel_code: z.string().optional().describe("Channel filter"),
            tags: z.string().optional().describe("Tags filter (comma-separated)"),
            status: jobStatusSchema.optional().describe("Status filter"),
        }
    }, async (params) => {
        mcpDebugger.toolCall("get_jobs_stats", params);
        try {
            const response = await withTiming(() => agentJobsClient.getStats(params), "get_jobs_stats API call");
            const stats = response.meta?.stats || {};
            const filters = response.meta?.filters || {};
            mcpDebugger.debug("Raw API response", { stats, filters });
            const result = {
                content: [{
                        type: "text",
                        text: formatJobStats(stats, filters),
                    }]
            };
            mcpDebugger.toolResponse("get_jobs_stats", result);
            return result;
        }
        catch (error) {
            mcpDebugger.toolError("get_jobs_stats", error);
            return {
                content: [{
                        type: "text",
                        text: `Error getting job stats: ${error.message}`,
                    }],
            };
        }
    });
};
