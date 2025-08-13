import axios from 'axios';
import { config } from '../config.js';
class AgentJobsClient {
    client = null;
    getClient() {
        if (!this.client) {
            const { AICONNECT_API_URL, AICONNECT_API_KEY } = config;
            if (!AICONNECT_API_URL || !AICONNECT_API_KEY) {
                throw new Error('API URL or Key is not configured. Please set AICONNECT_API_URL and AICONNECT_API_KEY environment variables.');
            }
            this.client = axios.create({
                baseURL: AICONNECT_API_URL,
                headers: {
                    'Authorization': `Bearer ${AICONNECT_API_KEY}`,
                    'X-Client-Type': 'mcp',
                    'Content-Type': 'application/json'
                }
            });
        }
        return this.client;
    }
    async get(endpoint, params) {
        return this.request(() => this.getClient().get(endpoint, { params }), params);
    }
    async getWithMeta(endpoint, params) {
        try {
            const response = await this.getClient().get(endpoint, { params });
            return response.data; // Return the full API response including data and meta
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getStats(filters = {}) {
        const params = {
            ...filters,
            include: 'stats',
            limit: 1
        };
        return this.get('/services/agent-jobs', params);
    }
    async post(endpoint, data) {
        return this.request(() => this.getClient().post(endpoint, data));
    }
    async patch(endpoint, data) {
        return this.request(() => this.getClient().patch(endpoint, data));
    }
    async delete(endpoint, data) {
        return this.request(() => this.getClient().delete(endpoint, { data }));
    }
    async request(requestFn, params) {
        try {
            const response = await requestFn();
            if (params?.include === 'stats') {
                // @ts-expect-error axios response typing varies per call in this client
                return response.data;
            }
            // @ts-expect-error axios response typing varies per call in this client
            return response.data?.data || response.data;
        }
        catch (error) {
            this.handleError(error);
        }
    }
    handleError(error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error;
            const apiError = axiosError.response?.data?.message || axiosError.response?.data?.error || JSON.stringify(axiosError.response?.data);
            throw new Error(`API Error (${axiosError.response?.status}): ${apiError || axiosError.message}`);
        }
        else if (error instanceof Error) {
            throw new Error(`Error: ${error.message}`);
        }
        else {
            throw new Error('An unknown error occurred.');
        }
    }
}
export default new AgentJobsClient();
