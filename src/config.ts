// Configuration with fallback to .env-example defaults
export const config = {
  DEFAULT_ORG_ID: process.env.DEFAULT_ORG_ID || 'aiconnect',
  AICONNECT_API_KEY: process.env.AICONNECT_API_KEY || '',
  AICONNECT_API_URL: process.env.AICONNECT_API_URL || 'https://api.aiconnect.cloud/api/v0'
};