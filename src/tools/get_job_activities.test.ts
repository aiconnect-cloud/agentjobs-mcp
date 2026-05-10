import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

vi.mock('../lib/agentJobsClient.js', () => ({
  default: {
    get: vi.fn(),
    getWithMeta: vi.fn(),
  },
}));

import agentJobsClient from '../lib/agentJobsClient.js';
import registerGetJobActivities from './get_job_activities.js';

interface CapturedTool {
  name: string;
  config: { inputSchema: Record<string, any> };
  handler: (params: any) => Promise<{ content: { type: 'text'; text: string }[] }>;
}

function captureTool(): CapturedTool {
  const captured: Partial<CapturedTool> = {};
  const fakeServer = {
    registerTool(name: string, config: any, handler: any) {
      captured.name = name;
      captured.config = config;
      captured.handler = handler;
    },
  } as any;
  registerGetJobActivities(fakeServer);
  return captured as CapturedTool;
}

const baseActivity = {
  id: 'a1',
  activity_type_code: 'ai_completion',
  status: 'completed',
  allocated_credits: 1,
  consumed_credits: 1,
  created_at: '2026-05-10T10:00:00.000Z',
  updated_at: '2026-05-10T10:00:00.000Z',
  source: { type: 'dispatch' },
};

describe('get_job_activities tool', () => {
  let tool: CapturedTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = captureTool();
  });

  it('sends defaults when only job_id is provided', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: [baseActivity],
      meta: { count: 1, limit: 50, total: 1 },
    });

    await tool.handler({ job_id: 'job_x' });

    expect(agentJobsClient.getWithMeta).toHaveBeenCalledTimes(1);
    const [endpoint, params] = (agentJobsClient.getWithMeta as any).mock.calls[0];
    expect(endpoint).toBe('/services/activities');
    expect(params).toMatchObject({
      job_id: 'job_x',
      limit: 50,
      offset: 0,
      sort: '-created_at',
    });
    expect(params.status).toBeUndefined();
    expect(params.activity_type_code).toBeUndefined();
    expect(params.source_type).toBeUndefined();
  });

  it('forwards every filter when provided', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: [],
      meta: { count: 0, limit: 50, total: 0 },
    });

    await tool.handler({
      job_id: 'job_x',
      org_id: 'woba',
      status: 'completed',
      activity_type_code: 'ai_completion',
      source_type: 'dispatch',
      limit: 25,
      offset: 50,
      sort: 'created_at',
    });

    const [, params] = (agentJobsClient.getWithMeta as any).mock.calls[0];
    expect(params).toEqual({
      job_id: 'job_x',
      org_id: 'woba',
      status: 'completed',
      activity_type_code: 'ai_completion',
      source_type: 'dispatch',
      limit: 25,
      offset: 50,
      sort: 'created_at',
    });
  });

  it('renders the activities list with footer for non-empty results', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: [baseActivity],
      meta: { count: 1, limit: 50, total: 1 },
    });

    const out = await tool.handler({ job_id: 'job_x' });

    expect(out.content[0].text).toContain('Activities for job job_x (showing 1):');
    expect(out.content[0].text).toContain('id: a1');
    expect(out.content[0].text).toContain('Returned: 1 | Total matching: 1 | Has more: false | Next offset: null');
  });

  it('renders empty-state with full footer when API returns no activities', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: [],
      meta: { count: 0, limit: 50, total: 0 },
    });
    const out = await tool.handler({ job_id: 'job_y' });
    expect(out.content[0].text).toContain('No activities found for job job_y.');
    expect(out.content[0].text).toContain('Returned: 0 | Total matching: 0 | Has more: false | Next offset: null');
  });

  it('Zod schema rejects empty job_id', () => {
    const shape = z.object(tool.config.inputSchema as any);
    expect(shape.safeParse({ job_id: '' }).success).toBe(false);
  });

  it('Zod schema rejects unknown status value', () => {
    const shape = z.object(tool.config.inputSchema as any);
    expect(shape.safeParse({ job_id: 'x', status: 'pending' }).success).toBe(false);
  });

  it('Zod schema rejects unknown source_type value', () => {
    const shape = z.object(tool.config.inputSchema as any);
    expect(shape.safeParse({ job_id: 'x', source_type: 'batch' }).success).toBe(false);
  });

  it('Zod schema rejects negative offset', () => {
    const shape = z.object(tool.config.inputSchema as any);
    expect(shape.safeParse({ job_id: 'x', offset: -1 }).success).toBe(false);
  });

  it('Zod schema rejects zero or negative limit', () => {
    const shape = z.object(tool.config.inputSchema as any);
    expect(shape.safeParse({ job_id: 'x', limit: 0 }).success).toBe(false);
    expect(shape.safeParse({ job_id: 'x', limit: -5 }).success).toBe(false);
  });

  it('Zod schema accepts open activity_type_code strings', () => {
    const shape = z.object(tool.config.inputSchema as any);
    expect(shape.safeParse({ job_id: 'x', activity_type_code: 'ai_completion' }).success).toBe(true);
    expect(shape.safeParse({ job_id: 'x', activity_type_code: 'new_unknown_type' }).success).toBe(true);
  });

  it('returns error message when API throws', async () => {
    (agentJobsClient.getWithMeta as any).mockRejectedValue(new Error('boom'));
    const out = await tool.handler({ job_id: 'job_x' });
    expect(out.content[0].text).toBe('Error getting job activities: boom');
  });
});
