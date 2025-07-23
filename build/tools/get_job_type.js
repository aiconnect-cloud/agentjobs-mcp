import { z } from 'zod';
import axios from 'axios';
import { config } from '../config.js';
import { formatJobTypeDetails } from '../utils/formatters.js';
export default (server) => {
    server.tool('get_job_type', 'Retrieves an agent job type by its ID.', {
        job_type_id: z.string({
            description: "The unique identifier of the job type you want to retrieve. Example: 'mood-monitor'."
        }),
        org_id: z.string({
            description: "The organization ID. Example: 'aiconnect'."
        }).optional()
    }, async (params) => {
        const { job_type_id } = params;
        const org_id = params.org_id || config.DEFAULT_ORG_ID;
        const apiUrl = config.AICONNECT_API_URL;
        const apiKey = config.AICONNECT_API_KEY;
        if (!apiUrl) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'Error: API URL is not configured. Please set AICONNECT_API_URL environment variable.'
                    }
                ]
            };
        }
        if (!apiKey) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'Error: API Key is not configured. Please set AICONNECT_API_KEY environment variable.'
                    }
                ]
            };
        }
        const endpoint = `${apiUrl}/organizations/${org_id}/agent-jobs-type/${job_type_id}`;
        const headers = {
            Authorization: `Bearer ${apiKey}`
        };
        try {
            const response = await axios.get(endpoint, {
                headers
            });
            const jobType = response.data?.data || response.data;
            return {
                content: [
                    {
                        type: 'text',
                        text: formatJobTypeDetails(jobType)
                    }
                ]
            };
        }
        catch (error) {
            let errorMessage = `Failed to retrieve job type ${job_type_id}.`;
            let errorDetails = {};
            if (axios.isAxiosError(error) && error.response) {
                const apiError = error.response.data?.message ||
                    error.response.data?.error ||
                    JSON.stringify(error.response.data);
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
                content: [
                    {
                        type: 'text',
                        text: errorMessage
                    }
                ]
            };
        }
    });
};
