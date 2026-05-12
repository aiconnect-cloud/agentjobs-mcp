import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

vi.mock('../lib/agentJobsClient.js', () => ({
  default: {
    get: vi.fn(),
    getWithMeta: vi.fn(),
  },
}));

import agentJobsClient from '../lib/agentJobsClient.js';
import registerListJobs from './list_jobs.js';

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
  registerListJobs(fakeServer);
  return captured as CapturedTool;
}

const sampleJob = {
  job_id: 'j1',
  channel_code: 'ch1',
  created_at: '2026-05-10T10:00:00.000Z',
  updated_at: '2026-05-10T10:00:00.000Z',
  scheduled_at: '2026-05-10T09:55:00.000Z',
  job_status: 'completed',
  result: null,
  job_type_id: 't1',
};

describe('list_jobs tool', () => {
  let tool: CapturedTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = captureTool();
  });

  it('does not send activities params when flag is off', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: [sampleJob],
      meta: { count: 1, limit: 20, total: 1 },
    });

    await tool.handler({ status: 'completed' });

    const [, params] = (agentJobsClient.getWithMeta as any).mock.calls[0];
    expect(params.include).toBeUndefined();
    expect(params.activities_limit_per_job).toBeUndefined();
    expect(params.activities_total_limit).toBeUndefined();
    expect(params.activities_sort).toBeUndefined();
  });

  it('sends include + 3 activity params with defaults when flag is on', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: [sampleJob],
      meta: { count: 1, limit: 20, total: 1 },
    });

    await tool.handler({ include_activities: true });

    const [, params] = (agentJobsClient.getWithMeta as any).mock.calls[0];
    expect(params).toMatchObject({
      include: 'activities',
      activities_limit_per_job: 15,
      activities_total_limit: 500,
      activities_sort: '-created_at',
    });
  });

  it('honours activity overrides', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: [sampleJob],
      meta: { count: 1, limit: 20, total: 1 },
    });

    await tool.handler({
      include_activities: true,
      activities_limit_per_job: 50,
      activities_total_limit: 1000,
      activities_sort: 'created_at',
    });

    const [, params] = (agentJobsClient.getWithMeta as any).mock.calls[0];
    expect(params).toMatchObject({
      include: 'activities',
      activities_limit_per_job: 50,
      activities_total_limit: 1000,
      activities_sort: 'created_at',
    });
  });

  it('renders activities truncated footer line when meta.activities_truncated=true', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: [sampleJob],
      meta: {
        count: 1,
        limit: 20,
        total: 1,
        activities_truncated: true,
        activities_total_returned: 45,
        activities_total_available: 120,
      },
    });

    const out = await tool.handler({ include_activities: true });
    expect(out.content[0].text).toContain('Activities truncated: yes (returned 45 of 120 available)');
  });

  it('Zod schema accepts overlay-only fields with any value when flag is off (spec: silently ignored)', () => {
    const shape = z.object(tool.config.inputSchema as any);
    expect(shape.safeParse({ activities_total_limit: 5000 }).success).toBe(true);
    expect(shape.safeParse({ activities_limit_per_job: 0 }).success).toBe(true);
    expect(shape.safeParse({ activities_limit_per_job: 200 }).success).toBe(true);
    expect(shape.safeParse({ activities_sort: 'updated_at' }).success).toBe(true);
  });

  it('flag-off + invalid overlay fields: handler ignores them and proceeds', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: [sampleJob],
      meta: { count: 1, limit: 20, total: 1 },
    });
    const out = await tool.handler({
      activities_total_limit: 5000,
      activities_limit_per_job: 200,
      activities_sort: 'updated_at',
    });
    expect(out.content[0].text).not.toMatch(/^Error/);
    const [, params] = (agentJobsClient.getWithMeta as any).mock.calls[0];
    expect(params.include).toBeUndefined();
    expect(params.activities_limit_per_job).toBeUndefined();
    expect(params.activities_total_limit).toBeUndefined();
    expect(params.activities_sort).toBeUndefined();
  });

  it('flag-on + activities_total_limit=5000: handler rejects', async () => {
    const out = await tool.handler({ include_activities: true, activities_total_limit: 5000 });
    expect(out.content[0].text).toBe('Error listing jobs: activities_total_limit must be an integer in [1, 3000]');
    expect(agentJobsClient.getWithMeta).not.toHaveBeenCalled();
  });

  it('flag-on + activities_limit_per_job=0: handler rejects', async () => {
    const out = await tool.handler({ include_activities: true, activities_limit_per_job: 0 });
    expect(out.content[0].text).toBe('Error listing jobs: activities_limit_per_job must be an integer in [1, 100]');
    expect(agentJobsClient.getWithMeta).not.toHaveBeenCalled();
  });

  it('flag-on + activities_limit_per_job=200: handler rejects', async () => {
    const out = await tool.handler({ include_activities: true, activities_limit_per_job: 200 });
    expect(out.content[0].text).toBe('Error listing jobs: activities_limit_per_job must be an integer in [1, 100]');
    expect(agentJobsClient.getWithMeta).not.toHaveBeenCalled();
  });

  it('flag-on + activities_sort=updated_at: handler rejects', async () => {
    const out = await tool.handler({ include_activities: true, activities_sort: 'updated_at' });
    expect(out.content[0].text).toBe("Error listing jobs: activities_sort must be 'created_at' or '-created_at'");
    expect(agentJobsClient.getWithMeta).not.toHaveBeenCalled();
  });

  it('flag-off output surfaces activities_count when the job document carries it', async () => {
    // activities_count is a backend-maintained field that is ALWAYS present on the
    // job document (per the API contract), independent of include=activities. We
    // intentionally surface it in flag-off output because it is "free" information
    // useful for triage. Only the overlay (`Activities` array) and `meta.activities_*`
    // fields are gated by the flag.
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: [{ ...sampleJob, activities_count: 12 }],
      meta: { count: 1, limit: 20, total: 1 },
    });

    const out = await tool.handler({});
    expect(out.content[0].text).toContain('Activities: 12');
    expect(out.content[0].text).not.toContain('overlay:');
    expect(out.content[0].text).not.toContain('Activities truncated:');
  });

  it('flag-off output omits the activities line when activities_count is absent', async () => {
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: [sampleJob],
      meta: { count: 1, limit: 20, total: 1 },
    });

    const out = await tool.handler({});
    // No `activities_count`, no `Activities` overlay → line omitted entirely.
    expect(out.content[0].text).not.toContain('Activities:');
  });

  it('flag-off output never shows the global truncation line', async () => {
    // meta.activities_truncated only exists when include=activities; ensure that
    // a backend that mistakenly leaks it without the flag still does not corrupt
    // the footer for callers who didn't ask for activities.
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: [sampleJob],
      meta: { count: 1, limit: 20, total: 1, activities_truncated: false },
    });
    const out = await tool.handler({});
    expect(out.content[0].text).not.toContain('Activities truncated:');
  });

  it('flag-off output ignores leaked meta.activities_truncated=true (fail-closed)', async () => {
    // If the backend mistakenly leaks `activities_truncated: true` in meta when
    // the flag was not requested, the formatter must still suppress the line.
    // The handler conveys the flag state to the formatter so it does not have to
    // infer from possibly-leaked fields.
    (agentJobsClient.getWithMeta as any).mockResolvedValue({
      data: [sampleJob],
      meta: {
        count: 1,
        limit: 20,
        total: 1,
        activities_truncated: true,
        activities_total_returned: 45,
        activities_total_available: 120,
      },
    });
    const out = await tool.handler({});
    expect(out.content[0].text).not.toContain('Activities truncated:');
  });
});
