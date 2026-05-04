import { z } from 'zod';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import agentJobsClient, { type ListJobTypesResponse } from '../lib/agentJobsClient.js';
import { config } from '../config.js';
import { formatContext, type ContextJobType } from '../utils/formatters.js';
import { mcpServerVersion } from '../utils/version.js';
import { mcpDebugger, withTiming } from '../utils/debugger.js';

export default (server: McpServer) => {
  server.registerTool(
    'get_context',
    {
      description:
        'Returns the MCP server runtime context: local defaults (org_id, timezone, API URL, server version) plus the list of agent job types available in the effective organization. Designed to be the first call an LLM client makes — surfaces what would otherwise be invisible env vars and avoids guessing valid job type IDs before calling create_job.',
      annotations: {
        title: 'Get MCP Server Runtime Context'
      },
      inputSchema: {
        org_id: z
          .string()
          .optional()
          .describe('Override DEFAULT_ORG_ID for this call (introspect a different org without restarting the server)')
      }
    },
    async (params) => {
      mcpDebugger.toolCall('get_context', params);

      const effectiveOrgId = params.org_id || config.DEFAULT_ORG_ID;
      const localConfig = {
        org_id: effectiveOrgId,
        timezone: config.DEFAULT_TIMEZONE,
        api_url: config.AICONNECT_API_URL,
        server_version: mcpServerVersion
      };

      let jobTypes: ContextJobType[] | undefined;
      let total: number | undefined;
      let jobTypesError: string | undefined;

      try {
        const response: ListJobTypesResponse = await withTiming(
          () => agentJobsClient.listJobTypes(effectiveOrgId),
          'get_context.listJobTypes API call'
        );
        jobTypes = (response?.data ?? []).map((jt) => ({
          id: jt.id,
          name: jt.name,
          description: jt.description,
          emoji: jt.emoji
        }));
        total = response?.meta?.total ?? jobTypes.length;
      } catch (error: any) {
        jobTypesError = error?.message ?? String(error);
        mcpDebugger.toolError('get_context.listJobTypes', error);
      }

      const text = formatContext({ localConfig, jobTypes, total, jobTypesError });

      mcpDebugger.toolResponse('get_context', {
        org_id: effectiveOrgId,
        jobTypesCount: jobTypes?.length,
        hasError: !!jobTypesError,
        resultLength: text.length
      });

      return {
        content: [
          {
            type: 'text' as const,
            text
          }
        ]
      };
    }
  );
};
