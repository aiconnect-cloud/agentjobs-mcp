import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import agentJobsClient from '../lib/agentJobsClient.js';
import { formatJobActivitiesList } from '../utils/formatters.js';
import {
  activityStatusSchema,
  activitySourceTypeSchema,
} from '../utils/schemas.js';
import { mcpDebugger, withTiming } from '../utils/debugger.js';

export default (server: McpServer) => {
  server.registerTool(
    'get_job_activities',
    {
      description:
        "Retrieves the audit activity trail for a specific agent job via the dedicated /services/activities endpoint. Supports real pagination (no truncation) and server-side filters by status, type and source. Use this for focused investigation of a job's activity log; for a quick overlay of recent activities on the job detail, use get_job with include_activities=true.",
      annotations: {
        title: 'Get Agent Job Activities'
      },
      inputSchema: {
        job_id: z.string().min(1).describe(
          "The unique identifier of the agent job whose activities you want to retrieve. Required."
        ),
        org_id: z.string().optional().describe(
          "The organization ID. If omitted, the default from the environment is used."
        ),
        status: activityStatusSchema().optional().describe(
          "Filter by activity status. Possible values: 'submitted', 'completed', 'canceled'."
        ),
        activity_type_code: z.string().optional().describe(
          "Filter by activity type code (open string, e.g., 'ai_completion')."
        ),
        source_type: activitySourceTypeSchema().optional().describe(
          "Filter by source type. Possible values: 'dispatch', 'process_module', 'direct'."
        ),
        limit: z.number().int().positive().optional().describe(
          "Maximum number of activities to return per page. Default 50."
        ),
        offset: z.number().int().nonnegative().optional().describe(
          "Number of activities to skip, used for pagination. Default 0."
        ),
        sort: z.string().optional().describe(
          "Field and direction to sort by. Default '-created_at' (newest first)."
        )
      }
    },
    async (params) => {
      mcpDebugger.toolCall('get_job_activities', params);

      const endpoint = '/services/activities';

      const queryParams: Record<string, any> = {
        job_id: params.job_id,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
        sort: params.sort ?? '-created_at',
      };
      if (params.org_id) queryParams.org_id = params.org_id;
      if (params.status) queryParams.status = params.status;
      if (params.activity_type_code) queryParams.activity_type_code = params.activity_type_code;
      if (params.source_type) queryParams.source_type = params.source_type;

      mcpDebugger.debug('Built query parameters', { endpoint, queryParams });

      try {
        const apiResponse = await withTiming(
          () => agentJobsClient.getWithMeta(endpoint, queryParams),
          'get_job_activities API call'
        );

        const activities = apiResponse?.data ?? [];
        const meta = apiResponse?.meta ?? {};
        const offset = queryParams.offset;

        const result = {
          content: [{
            type: 'text' as const,
            text: formatJobActivitiesList(params.job_id, activities, meta, offset),
          }]
        };

        mcpDebugger.toolResponse('get_job_activities', {
          jobId: params.job_id,
          activitiesReturned: activities.length,
          resultLength: result.content[0].text.length
        });

        return result;
      } catch (error: any) {
        mcpDebugger.toolError('get_job_activities', error);

        return {
          content: [{
            type: 'text' as const,
            text: `Error getting job activities: ${error.message}`,
          }],
        };
      }
    }
  );
};
