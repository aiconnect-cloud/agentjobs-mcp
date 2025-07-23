import { z } from "zod";
import axios from 'axios';
import { config } from '../config.js';
import { formatJobList } from "../utils/formatters.js";
// Define the schema for job status based on docs/agent-jobs-api.md:246-251
const jobStatusSchema = z.enum([
    "waiting",
    "scheduled",
    "running",
    "completed",
    "failed",
    "canceled"
]);
export default (server) => {
    server.tool("list_jobs", "Retrieves a list of agent jobs, with optional filters and pagination.", {
        org_id: z.string().optional().describe("Filter by organization ID. If not provided, the default from the environment is used."),
        status: jobStatusSchema.optional().describe("Filter by job status. Possible values are: 'waiting', 'scheduled', 'running', 'completed', 'failed', 'canceled'."),
        scheduled_at: z.string().datetime().optional().describe("Filter by the exact scheduled time in ISO 8601 format (e.g., '2024-07-23T10:00:00Z')."),
        scheduled_at_gte: z.string().datetime().optional().describe("Filter for jobs scheduled at or after a specific time (ISO 8601)."),
        scheduled_at_lte: z.string().datetime().optional().describe("Filter for jobs scheduled at or before a specific time (ISO 8601)."),
        created_at_gte: z.string().datetime().optional().describe("Filter for jobs created at or after a specific time (ISO 8601)."),
        created_at_lte: z.string().datetime().optional().describe("Filter for jobs created at or before a specific time (ISO 8601)."),
        job_type_id: z.string().optional().describe("Filter by the specific job type ID (e.g., 'daily-report')."),
        channel_code: z.string().optional().describe("Filter by the channel code (e.g., 'C123456' for a Slack channel)."),
        limit: z.number().int().positive().optional().describe("Maximum number of jobs to return (e.g.,20). Default is 20."),
        offset: z.number().int().nonnegative().optional().describe("Number of jobs to skip, used for pagination. Default is 0."),
        sort: z.string().optional().describe("Field to sort by and direction. Format is 'field:direction'. Example: 'created_at:desc'."),
    }, async (params) => {
        const apiUrl = config.AICONNECT_API_URL;
        const apiKey = config.AICONNECT_API_KEY;
        if (!apiUrl) {
            return {
                content: [{
                        type: "text",
                        text: "Error: API URL is not configured. Please set AICONNECT_API_URL environment variable."
                    }]
            };
        }
        if (!apiKey) {
            return {
                content: [{
                        type: "text",
                        text: "Error: API Key is not configured. Please set AICONNECT_API_KEY environment variable."
                    }]
            };
        }
        const endpoint = `${apiUrl}/services/agent-jobs`;
        const headers = {
            "Authorization": `Bearer ${apiKey}`,
        };
        // Build query parameters object from provided params
        const queryParams = {};
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) {
                queryParams[key] = value;
            }
        }
        try {
            const response = await axios.get(endpoint, {
                headers,
                params: queryParams,
            });
            const jobs = response.data?.data || [];
            const meta = response.data?.meta || {};
            return {
                content: [{
                        type: "text",
                        text: formatJobList(jobs, meta),
                    }]
            };
        }
        catch (error) {
            let errorMessage = `Failed to list jobs.`;
            let errorDetails = {};
            if (axios.isAxiosError(error) && error.response) {
                const apiError = error.response.data?.message || error.response.data?.error || JSON.stringify(error.response.data);
                errorMessage = `API Error (${error.response.status}): ${apiError || error.message}`;
                errorDetails = {
                    status: error.response.status,
                    data: error.response.data
                };
            }
            else if (error instanceof Error) {
                errorMessage = `Error: ${error.message}`;
            }
            return {
                content: [{
                        type: "text",
                        text: errorMessage,
                    }],
            };
        }
    });
};
