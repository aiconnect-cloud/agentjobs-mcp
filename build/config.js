// Configuration for the MCP server
export const config = {
    apiUrl: process.env.AICONNECT_API_URL || 'https://api.aiconnect.cloud/api/v0',
    apiKey: process.env.AICONNECT_API_KEY || '',
    defaultOrgId: process.env.DEFAULT_ORG_ID || 'aiconnect',
    debugMode: process.env.DEBUG === 'true',
    // Legacy compatibility
    AICONNECT_API_URL: process.env.AICONNECT_API_URL || 'https://api.aiconnect.cloud/api/v0',
    AICONNECT_API_KEY: process.env.AICONNECT_API_KEY || '',
    DEFAULT_ORG_ID: process.env.DEFAULT_ORG_ID || 'aiconnect'
};
