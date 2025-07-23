import { z } from 'zod';
import axios from 'axios';
import { config } from '../config.js';
/**
 * Lightweight Agent‑Jobs creator.
 * Only the essentials are required to keep the contract LLM‑friendly.
 */
export default (server) => {
    server.tool('create_job', 'Create a new Agent Job with the minimal set of fields.', {
        // ─────────────────────────────────────────────────────────────────────────┐
        // Required
        // ─────────────────────────────────────────────────────────────────────────┘
        job_type_id: z
            .string()
            .describe('ID of the job type (e.g. "mood-monitor")'),
        target_channel: z
            .object({
            platform: z
                .enum(['whatsapp', 'slack', 'web'])
                .describe('Destination platform.'),
            code: z
                .string()
                .describe('Channel identifier, phone number, or user ID.'),
            org_id: z
                .string()
                .optional()
                .describe('Org ID – defaults to config.DEFAULT_ORG_ID')
        })
            .describe('Where the agent will communicate.'),
        params: z
            .record(z.any())
            .optional()
            .describe('Free‑form params passed to the agent'),
        scheduled_at: z
            .string()
            .datetime({ message: 'Use ISO‑8601' })
            .optional()
            .describe('Schedule the job to run later')
    }, 
    // ───────────────────────────────────────────────────────────────────────────┐
    // Implementation                                                             │
    // ───────────────────────────────────────────────────────────────────────────┘
    async ({ ...body }) => {
        const { AICONNECT_API_URL: apiUrl, AICONNECT_API_KEY: apiKey, DEFAULT_ORG_ID } = config;
        if (!apiUrl || !apiKey) {
            return {
                content: [
                    {
                        type: 'text',
                        text: 'API credentials are missing – set AICONNECT_API_URL and AICONNECT_API_KEY.'
                    }
                ]
            };
        }
        // Fall back to default org if none supplied.
        body.target_channel.org_id ??= DEFAULT_ORG_ID;
        try {
            const res = await axios.post(`${apiUrl}/services/agent-jobs`, body, {
                headers: { Authorization: `Bearer ${apiKey}` }
            });
            const jobId = res.data?.data?.id ?? res.data?.id ?? 'unknown';
            return {
                content: [
                    {
                        type: 'text',
                        text: `✅ Job created (id: ${jobId}).`
                    }
                ]
            };
        }
        catch (err) {
            const status = err.response?.status;
            const apiMsg = err.response?.data?.message ?? err.response?.data?.error;
            const message = status
                ? `API ${status}: ${apiMsg}`
                : `Error: ${err.message}`;
            return {
                content: [
                    {
                        type: 'text',
                        text: message
                    }
                ]
            };
        }
    });
};
