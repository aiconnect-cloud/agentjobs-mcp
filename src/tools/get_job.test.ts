import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

vi.mock('../lib/agentJobsClient.js', () => ({
  default: {
    get: vi.fn(),
    getWithMeta: vi.fn(),
  },
}));

import agentJobsClient from '../lib/agentJobsClient.js';
import registerGetJob from './get_job.js';

type ToolHandler = (params: any) => Promise<{ content: { type: 'text'; text: string }[] }>;

interface CapturedTool {
  name: string;
  config: { inputSchema: Record<string, any> };
  handler: ToolHandler;
}

function captureTool(): CapturedTool {
  const captured: Partial<CapturedTool> = {};
  const fakeServer = {
    registerTool(name: string, config: any, handler: ToolHandler) {
      captured.name = name;
      captured.config = config;
      captured.handler = handler;
    },
  } as any;
  registerGetJob(fakeServer);
  if (!captured.name || !captured.handler || !captured.config) {
    throw new Error('Tool was not registered');
  }
  return captured as CapturedTool;
}

const baseJob = {
  job_id: 'job_a',
  job_type_id: 'type_a',
  org_id: 'org_a',
  channel_code: 'ch_a',
  job_status: 'completed',
  created_at: '2026-05-10T10:00:00.000Z',
  updated_at: '2026-05-10T10:30:00.000Z',
};

describe('get_job tool', () => {
  let tool: CapturedTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = captureTool();
  });

  it('routes through getWithMeta and sends no include params when flag is off', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({ data: baseJob, meta: {} });

    await tool.handler({ job_id: 'job_a' });

    expect(agentJobsClient.getWithMeta).toHaveBeenCalledTimes(1);
    const [endpoint, params] = (agentJobsClient.getWithMeta as any).mock.calls[0];
    expect(endpoint).toBe('/services/agent-jobs/job_a');
    expect(params).toEqual({});
  });

  it('forwards org_id when provided without flag', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({ data: baseJob, meta: {} });
    await tool.handler({ job_id: 'job_a', org_id: 'woba' });
    const [, params] = (agentJobsClient.getWithMeta as any).mock.calls[0];
    expect(params).toEqual({ org_id: 'woba' });
  });

  it('sends include params with defaults when include_activities=true', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({ data: baseJob, meta: {} });
    await tool.handler({ job_id: 'job_a', include_activities: true });
    const [, params] = (agentJobsClient.getWithMeta as any).mock.calls[0];
    expect(params).toMatchObject({
      include: 'activities',
      include_limit: 50,
      include_sort: '-created_at',
    });
  });

  it('honours include_limit and include_sort overrides', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({ data: baseJob, meta: {} });
    await tool.handler({
      job_id: 'job_a',
      include_activities: true,
      include_limit: 20,
      include_sort: 'created_at',
    });
    const [, params] = (agentJobsClient.getWithMeta as any).mock.calls[0];
    expect(params).toMatchObject({
      include: 'activities',
      include_limit: 20,
      include_sort: 'created_at',
    });
  });

  it('renders Activities block when API returns Activities array', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: {
        ...baseJob,
        Activities: [
          {
            id: 'a1',
            activity_type_code: 'ai_completion',
            status: 'completed',
            allocated_credits: 1,
            consumed_credits: 1,
            created_at: '2026-05-10T10:05:00.000Z',
            updated_at: '2026-05-10T10:05:00.000Z',
            source: { type: 'dispatch' },
          },
        ],
      },
      meta: { activities_meta: { count: 1, limit: 50 } },
    });
    const out = await tool.handler({ job_id: 'job_a', include_activities: true });
    expect(out.content[0].text).toContain('Activities:');
    expect(out.content[0].text).toContain('id: a1');
    expect(out.content[0].text).not.toContain('use get_job_activities for full pagination');
  });

  it('renders truncation hint when meta.activities_meta.count > limit', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: {
        ...baseJob,
        Activities: [
          {
            id: 'a1',
            activity_type_code: 'x',
            status: 'completed',
            allocated_credits: 0,
            consumed_credits: 0,
            created_at: '2026-05-10T10:05:00.000Z',
            updated_at: '2026-05-10T10:05:00.000Z',
            source: { type: 'dispatch' },
          },
        ],
      },
      meta: { activities_meta: { count: 200, limit: 50 } },
    });
    const out = await tool.handler({ job_id: 'job_a', include_activities: true });
    expect(out.content[0].text).toContain(
      '(showing 1 of 200 activities — use get_job_activities for full pagination)'
    );
  });

  it('Zod schema accepts overlay-only fields with any value when flag is off (spec: silently ignored)', () => {
    const shape = z.object(tool.config.inputSchema as any);
    expect(shape.safeParse({ job_id: 'x', include_limit: 200 }).success).toBe(true);
    expect(shape.safeParse({ job_id: 'x', include_limit: 0 }).success).toBe(true);
    expect(shape.safeParse({ job_id: 'x', include_sort: 'updated_at' }).success).toBe(true);
    expect(shape.safeParse({ job_id: 'x', include_sort: 'created_at' }).success).toBe(true);
  });

  it('flag-off + invalid overlay fields: handler ignores them and proceeds', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({ data: baseJob, meta: {} });
    const out = await tool.handler({ job_id: 'job_a', include_limit: 999, include_sort: 'updated_at' });
    expect(out.content[0].text).not.toMatch(/^Error/);
    const [, params] = (agentJobsClient.getWithMeta as any).mock.calls[0];
    expect(params.include).toBeUndefined();
    expect(params.include_limit).toBeUndefined();
    expect(params.include_sort).toBeUndefined();
  });

  it('flag-on + include_limit=200: handler rejects before API call', async () => {
    const out = await tool.handler({ job_id: 'job_a', include_activities: true, include_limit: 200 });
    expect(out.content[0].text).toBe('Error getting job: include_limit must be an integer in [1, 100]');
    expect(agentJobsClient.getWithMeta).not.toHaveBeenCalled();
  });

  it('flag-on + include_limit=0: handler rejects before API call', async () => {
    const out = await tool.handler({ job_id: 'job_a', include_activities: true, include_limit: 0 });
    expect(out.content[0].text).toBe('Error getting job: include_limit must be an integer in [1, 100]');
    expect(agentJobsClient.getWithMeta).not.toHaveBeenCalled();
  });

  it('flag-on + include_sort=updated_at: handler rejects before API call', async () => {
    const out = await tool.handler({ job_id: 'job_a', include_activities: true, include_sort: 'updated_at' });
    expect(out.content[0].text).toBe("Error getting job: include_sort must be 'created_at' or '-created_at'");
    expect(agentJobsClient.getWithMeta).not.toHaveBeenCalled();
  });

  it('flag-on + include_sort=created_at: handler accepts and forwards', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({ data: baseJob, meta: {} });
    const out = await tool.handler({ job_id: 'job_a', include_activities: true, include_sort: 'created_at' });
    expect(out.content[0].text).not.toMatch(/^Error/);
    const [, params] = (agentJobsClient.getWithMeta as any).mock.calls[0];
    expect(params.include_sort).toBe('created_at');
  });

  it('Zod schema rejects empty job_id (no API call should fall through to /services/agent-jobs/)', () => {
    const shape = z.object(tool.config.inputSchema as any);
    const r = shape.safeParse({ job_id: '' });
    expect(r.success).toBe(false);
  });

  it('returns error message when API throws', async () => {
    (agentJobsClient.getWithMeta as any).mockRejectedValue(new Error('boom'));
    const out = await tool.handler({ job_id: 'job_a' });
    expect(out.content[0].text).toBe('Error getting job: boom');
  });

  it('flag-off output contains no activity-related lines (regression)', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({ data: baseJob, meta: {} });
    const out = await tool.handler({ job_id: 'job_a' });
    const text = out.content[0].text;
    expect(text).not.toContain('Activities:');
    expect(text).not.toContain('(no activities recorded');
    expect(text).not.toContain('use get_job_activities for full pagination');
  });

  it('flag-off output ends exactly where the legacy formatter ends (regression)', async () => {
    // Captures the prior shape of formatJobDetails by asserting the last logical
    // section ("Execution Log") closes the document — no trailing Activities block.
    (agentJobsClient.getWithMeta as any).mockResolvedValue({ data: baseJob, meta: {} });
    const text = (await tool.handler({ job_id: 'job_a' })).content[0].text;
    const trimmed = text.trimEnd();
    const lastMeaningfulLine = trimmed.split('\n').pop();
    expect(lastMeaningfulLine).toMatch(/Execution Log|n\/a|^- /);
    expect(trimmed.endsWith('Activities:')).toBe(false);
  });

  it('signals the empty-activities case when flag is on but job has no activities', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: baseJob,
      meta: { activities_meta: { count: 0, limit: 50 } },
    });
    const out = await tool.handler({ job_id: 'job_a', include_activities: true });
    expect(out.content[0].text).toContain('Activities:');
    expect(out.content[0].text).toContain('(no activities recorded for this job)');
  });

  it('flag-off output stays byte-identical even when backend leaks Activities in the payload (fail-closed)', async () => {
    // Establish the baseline with a clean payload.
    (agentJobsClient.getWithMeta as any)
      .mockResolvedValueOnce({ data: baseJob, meta: {} });
    const baseline = (await tool.handler({ job_id: 'job_a' })).content[0].text;

    // Now call again with the same flag-off request, but this time the backend
    // mistakenly includes `Activities` in the payload without the caller asking.
    // The formatter must NOT render the block — overlay request is signalled
    // exclusively by `meta.activities_meta`.
    (agentJobsClient.getWithMeta as any)
      .mockResolvedValueOnce({
        data: {
          ...baseJob,
          Activities: [
            {
              id: 'leaked',
              activity_type_code: 'x',
              status: 'completed',
              allocated_credits: 0,
              consumed_credits: 0,
              created_at: '2026-05-10T10:05:00.000Z',
              updated_at: '2026-05-10T10:05:00.000Z',
              source: { type: 'dispatch' },
            },
          ],
        },
        meta: {},
      });
    const withLeak = (await tool.handler({ job_id: 'job_a' })).content[0].text;

    expect(withLeak).toBe(baseline);
    expect(withLeak).not.toContain('Activities:');
    expect(withLeak).not.toContain('id: leaked');
  });

  it('preserves the formatted job document when only some overlay activities are malformed', async () => {
    // End-to-end regression: a single bad activity in the overlay must not
    // collapse the entire response into "Job Details (raw): ...". The good
    // activity renders normally, the bad one degrades per-entry.
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: {
        ...baseJob,
        Activities: [
          {
            id: 'good',
            activity_type_code: 'ai_completion',
            status: 'completed',
            allocated_credits: 1,
            consumed_credits: 1,
            created_at: '2026-05-10T10:05:00.000Z',
            updated_at: '2026-05-10T10:05:00.000Z',
            source: { type: 'dispatch' },
          },
          { id: 'bad-no-status' }, // malformed: missing required fields
        ],
      },
      meta: { activities_meta: { count: 2, limit: 50 } },
    });

    const out = await tool.handler({ job_id: 'job_a', include_activities: true });
    const text = out.content[0].text;
    expect(text).not.toContain('Job Details (raw):');
    expect(text).toContain('Job ID: job_a');
    expect(text).toContain('Activities:');
    expect(text).toContain('id: good');
    expect(text).toContain('[unparseable activity]');
  });
});
