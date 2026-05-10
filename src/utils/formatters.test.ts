import { describe, it, expect } from 'vitest';
import { formatJobDetails, formatJobList, formatJobStats, formatJobTypeDetails, formatJobTypeSummary, formatActivityEntry, formatJobActivitiesList } from './formatters.js';

describe('formatJobDetails', () => {
  const fullJob = {
    job_id: 'job_123',
    job_type_id: 'type_abc',
    org_id: 'org_xyz',
    channel_code: 'ch_def',
    chat_id: 'chat_456',
    job_status: 'completed',
    result: 'Success',
    created_at: '2023-01-01T10:00:00.000Z',
    updated_at: '2023-01-01T10:15:00.000Z',
    scheduled_at: '2023-01-01T09:55:00.000Z',
    last_task_created_at: '2023-01-01T10:10:00.000Z',
    tags: 'tag1, tag2',
    execution_log: ['Log entry 1', 'Log entry 2'],
    tasks: [{ task_id: 'task_789', created_at: '2023-01-01T10:05:00.000Z' }],
    flags: {
      is_new_channel: true,
      has_human_reply: false,
      first_reply_at: '2023-01-01T10:02:00.000Z',
      ignore_cooldown: true,
    },
    channel_data: {
      platform: 'test_platform',
      name: 'Test Channel',
    },
    job_config: {
      max_task_retries: 3,
      start_prompt: 'Initial prompt',
    },
    params: { key: 'value' },
  };

  it('should format a full job object correctly', () => {
    const result = formatJobDetails(fullJob);
    expect(result).toContain('Job ID: job_123');
    expect(result).toContain('Status: completed');
    expect(result).toContain('Result: Success');
    expect(result).toContain('Tags: tag1, tag2');
    expect(result).toContain('Total Tasks: 1');
    expect(result).toContain('Retries Used: 0 / 3 (remaining: 3)');
    expect(result).toContain('Duration: 20m 0s');
  });

  it('should handle minimal job object', () => {
    const minimalJob = {
      job_id: 'job_min',
      job_type_id: 'type_min',
      org_id: 'org_min',
      channel_code: 'ch_min',
      job_status: 'running',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const result = formatJobDetails(minimalJob);
    expect(result).toContain('Job ID: job_min');
    expect(result).toContain('Status: running');
    expect(result).toContain('Result: n/a');
    expect(result).toContain('Total Tasks: 0');
  });

  it('should handle dates as numbers (timestamps)', () => {
    const jobWithTimestamps = {
      ...fullJob,
      created_at: new Date(fullJob.created_at).getTime(),
      updated_at: new Date(fullJob.updated_at).getTime(),
    };
    const result = formatJobDetails(jobWithTimestamps);
    expect(result).toContain(`Created At: ${new Date(jobWithTimestamps.created_at).toISOString()}`);
    expect(result).toContain(`Updated At: ${new Date(jobWithTimestamps.updated_at).toISOString()}`);
  });

  it('should fall back to JSON.stringify for invalid job object', () => {
    const invalidJob = { job_id: '123' }; // Missing required fields
    const result = formatJobDetails(invalidJob);
    expect(result).toContain('"job_id": "123"');
    expect(result).toContain('Job Details (raw):');
  });
});

describe('formatJobStats', () => {
  it('should return correct percentages when total is greater than 0', () => {
    const stats = {
      status: {
        completed: 10,
        running: 5,
        failed: 2,
        canceled: 1,
        waiting: 1,
        scheduled: 1,
      },
    };
    const filters = {};
    const result = formatJobStats(stats, filters);
    expect(result).toContain('Completed:  10 jobs (50.0%)');
    expect(result).toContain('Running:     5 jobs (25.0%)');
    expect(result).toContain('Failed:      2 jobs (10.0%)');
    expect(result).toContain('Canceled:    1 jobs (5.0%)');
    expect(result).toContain('Waiting:     1 jobs (5.0%)');
    expect(result).toContain('Scheduled:  1 jobs (5.0%)');
    expect(result).toContain('Total Jobs: 20');
  });

  it('should return 0.0% for all statuses when there are no jobs', () => {
    const stats = {
      status: {
        completed: 0,
        running: 0,
        failed: 0,
        canceled: 0,
        waiting: 0,
        scheduled: 0,
      },
    };
    const filters = {};
    const result = formatJobStats(stats, filters);
    expect(result).toContain('Completed:  0 jobs (0.0%)');
    expect(result).toContain('Running:     0 jobs (0.0%)');
    expect(result).toContain('Failed:      0 jobs (0.0%)');
    expect(result).toContain('Canceled:    0 jobs (0.0%)');
    expect(result).toContain('Waiting:     0 jobs (0.0%)');
    expect(result).toContain('Scheduled:  0 jobs (0.0%)');
    expect(result).toContain('Total Jobs: 0');
  });

  it('should handle null filters gracefully', () => {
    const stats = {
      status: {
        completed: 10,
        running: 5,
        failed: 2,
        canceled: 1,
        waiting: 1,
        scheduled: 1,
      },
    };
    const filters = null;
    const result = formatJobStats(stats, filters);
    expect(result).toContain('Period: All time');
  });

  describe('header — Scheduled date range', () => {
    const stats = {
      status: { completed: 1, running: 0, failed: 0, canceled: 0, waiting: 0, scheduled: 0 },
    };

    it('renders both bounds when scheduled_at_gte and scheduled_at_lte are provided', () => {
      const result = formatJobStats(stats, {
        scheduled_at_gte: '2026-04-30T00:00:00Z',
        scheduled_at_lte: '2026-05-01T00:00:00Z',
      });
      expect(result).toContain('Scheduled: 2026-04-30T00:00:00Z → 2026-05-01T00:00:00Z');
      expect(result).not.toContain('Period: All time');
    });

    it('renders "(open)" upper bound when only scheduled_at_gte is provided', () => {
      const result = formatJobStats(stats, {
        scheduled_at_gte: '2026-04-30T00:00:00Z',
      });
      expect(result).toContain('Scheduled: 2026-04-30T00:00:00Z → (open)');
    });

    it('renders "(open)" lower bound when only scheduled_at_lte is provided', () => {
      const result = formatJobStats(stats, {
        scheduled_at_lte: '2026-05-01T00:00:00Z',
      });
      expect(result).toContain('Scheduled: (open) → 2026-05-01T00:00:00Z');
    });

    it('omits the Scheduled range line entirely when no scheduled_at bound is provided', () => {
      const result = formatJobStats(stats, { status: 'failed' });
      // The Status Breakdown contains "⏰ Scheduled:"; we only want to assert
      // the header-range form ("Scheduled: <bound> → ...") is absent.
      expect(result).not.toMatch(/(^|\n)Scheduled: .+→/);
    });
  });

  describe('header — Created date range', () => {
    const stats = {
      status: { completed: 1, running: 0, failed: 0, canceled: 0, waiting: 0, scheduled: 0 },
    };

    it('renders both bounds when created_at_gte and created_at_lte are provided', () => {
      const result = formatJobStats(stats, {
        created_at_gte: '2026-04-01T00:00:00Z',
        created_at_lte: '2026-04-30T00:00:00Z',
      });
      expect(result).toContain('Created: 2026-04-01T00:00:00Z → 2026-04-30T00:00:00Z');
    });

    it('renders "(open)" upper bound when only created_at_gte is provided', () => {
      const result = formatJobStats(stats, {
        created_at_gte: '2026-04-01T00:00:00Z',
      });
      expect(result).toContain('Created: 2026-04-01T00:00:00Z → (open)');
    });

    it('renders "(open)" lower bound when only created_at_lte is provided', () => {
      const result = formatJobStats(stats, {
        created_at_lte: '2026-04-30T00:00:00Z',
      });
      expect(result).toContain('Created: (open) → 2026-04-30T00:00:00Z');
    });

    it('omits the Created line entirely when no created_at bound is provided', () => {
      const result = formatJobStats(stats, { scheduled_at_gte: '2026-04-30T00:00:00Z' });
      expect(result).not.toContain('Created:');
    });

    it('renders both Scheduled and Created lines when both ranges are filtered', () => {
      const result = formatJobStats(stats, {
        scheduled_at_gte: '2026-04-30T00:00:00Z',
        created_at_gte: '2026-04-01T00:00:00Z',
      });
      expect(result).toContain('Scheduled: 2026-04-30T00:00:00Z → (open)');
      expect(result).toContain('Created: 2026-04-01T00:00:00Z → (open)');
    });
  });

  describe('header — Period: All time fallback', () => {
    const stats = {
      status: { completed: 1, running: 0, failed: 0, canceled: 0, waiting: 0, scheduled: 0 },
    };

    it('renders "Period: All time" when no date filter is provided', () => {
      const result = formatJobStats(stats, {});
      expect(result).toContain('Period: All time');
    });

    it('does not render "Period: All time" when scheduled_at_gte is set', () => {
      const result = formatJobStats(stats, { scheduled_at_gte: '2026-04-30T00:00:00Z' });
      expect(result).not.toContain('Period: All time');
    });

    it('does not render "Period: All time" when created_at_lte is set', () => {
      const result = formatJobStats(stats, { created_at_lte: '2026-04-30T00:00:00Z' });
      expect(result).not.toContain('Period: All time');
    });
  });

  describe('header — Filters section', () => {
    const stats = {
      status: { completed: 1, running: 0, failed: 0, canceled: 0, waiting: 0, scheduled: 0 },
    };

    it('renders a single line when one non-date filter is supplied', () => {
      const result = formatJobStats(stats, { status: 'failed' });
      expect(result).toContain('Filters:');
      expect(result).toContain('- status: failed');
    });

    it('renders multiple lines when multiple non-date filters are supplied', () => {
      const result = formatJobStats(stats, {
        status: 'failed',
        job_type_id: 'woba-supplier-ai-batch',
      });
      expect(result).toContain('- status: failed');
      expect(result).toContain('- job_type_id: woba-supplier-ai-batch');
    });

    it('omits the Filters section entirely when only date filters are supplied', () => {
      const result = formatJobStats(stats, { scheduled_at_gte: '2026-04-30T00:00:00Z' });
      expect(result).not.toContain('Filters:');
    });
  });
});

describe('formatJobList', () => {
  const sampleJob = {
    job_id: 'job_1',
    channel_code: 'ch_1',
    created_at: '2026-04-30T00:00:00.000Z',
    updated_at: '2026-04-30T00:10:00.000Z',
    scheduled_at: '2026-04-30T00:00:00.000Z',
    job_status: 'completed',
    result: 'ok',
    job_type_id: 'type_1',
  };

  it('renders the four-field footer on first page with more pages available', () => {
    const jobs = Array.from({ length: 20 }, (_, i) => ({ ...sampleJob, job_id: `job_${i}` }));
    const meta = { count: 20, limit: 20, total: 40 };
    const result = formatJobList(jobs, meta, 0);
    expect(result).toContain('Returned: 20 | Total matching: 40 | Has more: true | Next offset: 20');
    expect(result).not.toContain('Page:');
    expect(result).not.toContain('Total Jobs:');
  });

  it('renders Has more: false and Next offset: null on the last page', () => {
    const jobs = Array.from({ length: 20 }, (_, i) => ({ ...sampleJob, job_id: `job_${i}` }));
    const meta = { count: 20, limit: 20, total: 40 };
    const result = formatJobList(jobs, meta, 20);
    expect(result).toContain('Returned: 20 | Total matching: 40 | Has more: false | Next offset: null');
  });

  it('handles a partial last page (count < limit)', () => {
    const jobs = Array.from({ length: 5 }, (_, i) => ({ ...sampleJob, job_id: `job_${i}` }));
    const meta = { count: 5, limit: 20, total: 25 };
    const result = formatJobList(jobs, meta, 20);
    expect(result).toContain('Returned: 5 | Total matching: 25 | Has more: false | Next offset: null');
  });

  it('renders the footer on an empty result on the first page', () => {
    const meta = { count: 0, limit: 20, total: 0 };
    const result = formatJobList([], meta, 0);
    expect(result).toContain('Found 0 jobs.');
    expect(result).toContain('Returned: 0 | Total matching: 0 | Has more: false | Next offset: null');
    expect(result).not.toContain('No jobs found for the given criteria.');
  });

  it('renders Total matching reflecting real total when offset overflows the result set', () => {
    const meta = { count: 0, limit: 20, total: 40 };
    const result = formatJobList([], meta, 100);
    expect(result).toContain('Found 0 jobs.');
    expect(result).toContain('Returned: 0 | Total matching: 40 | Has more: false | Next offset: null');
  });

  describe('fail-fast on missing meta fields', () => {
    it('throws when meta is null', () => {
      expect(() => formatJobList([], null as any, 0)).toThrow(/meta is required/);
    });

    it('throws when meta.total is missing', () => {
      expect(() => formatJobList([], { count: 0, limit: 20 } as any, 0)).toThrow(
        /meta is required.*count.*limit.*total/
      );
    });

    it('throws when meta.count is non-numeric', () => {
      expect(() =>
        formatJobList([], { count: 'oops', limit: 20, total: 0 } as any, 0)
      ).toThrow(/meta is required/);
    });
  });
});

describe('formatJobTypeDetails', () => {
  const fullJobType = {
    id: 'follow-up-v2',
    name: 'Follow Up by DM',
    org_id: 'acme-co',
    version: 2,
    visibility: 'private',
    active: true,
    description: 'Automated follow-up to contacts who haven\'t replied within 24h. Supports templated prompts and throttling.',
    default_config: {
      profile_id: 'default-bot',
      max_follow_ups: 3,
      max_task_retries: 2,
      task_retry_interval: 30,
      max_time_to_complete: 180,
      failure_cooldown_minutes: 120,
      start_prompt: 'Hello! Just circling back on our last conversation...'
    },
    params_schema: {
      type: 'object',
      required: ['recipient_id', 'initial_message'],
      properties: {
        recipient_id: { type: 'string', description: 'User ID of the recipient' },
        initial_message: { type: 'string', description: 'Initial text to send to the recipient' },
        locale: { type: 'string', default: 'en-US', description: 'Locale for message formatting' },
        throttle_minutes: { type: 'number', description: 'Min minutes between attempts' },
        metadata: { type: 'object', description: 'Free-form context data' }
      }
    },
    tags: 'outreach, dm, v2',
    created_at: '2025-08-02T14:03:28.120Z',
    updated_at: '2025-08-12T09:22:01.553Z'
  };

  it('should format a full job type object correctly', () => {
    const result = formatJobTypeDetails(fullJobType);
    expect(result).toContain('ID: follow-up-v2');
    expect(result).toContain('Name: Follow Up by DM');
    expect(result).toContain('Version: 2');
    expect(result).toContain('Visibility: private');
    expect(result).toContain('Active: yes');
    expect(result).toContain('Profile ID: default-bot');
    expect(result).toContain('Max Follow-ups: 3');
    expect(result).toContain('Max Task Retries: 2');
    expect(result).toContain('Task Retry Interval: 30 min');
    expect(result).toContain('retries up to 2 every 30 min');
    expect(result).toContain('window 180 min');
    expect(result).toContain('cooldown 120 min');
    expect(result).toContain('Type: object | Required: 2 | Properties: 5');
    expect(result).toContain('recipient_id: string (required)');
    expect(result).toContain('locale: string — Locale for message formatting — Defaults to "en-US"');
    expect(result).toContain('Tags: outreach, dm, v2');
  });

  it('should handle minimal job type object', () => {
    const minimalJobType = {
      id: 'minimal',
      name: 'Minimal Type',
      org_id: 'org-min',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const result = formatJobTypeDetails(minimalJobType);
    expect(result).toContain('ID: minimal');
    expect(result).toContain('Name: Minimal Type');
    expect(result).toContain('Org ID: org-min');
    expect(result).not.toContain('Version:');
    expect(result).not.toContain('Description:');
  });

  it('should handle missing optional fields gracefully', () => {
    const jobTypeNoConfig = {
      id: 'no-config',
      name: 'No Config Type',
      org_id: 'org-test',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };
    const result = formatJobTypeDetails(jobTypeNoConfig, { showEmptySections: true });
    expect(result).toContain('Default Config:');
    expect(result).toContain('n/a');
    expect(result).toContain('Params Schema:');
  });

  it('should truncate long strings with ellipsis', () => {
    const longDescription = 'A'.repeat(500);
    const longPrompt = 'B'.repeat(600);
    const jobTypeWithLongText = {
      id: 'long-text',
      name: 'Long Text Type',
      org_id: 'org-test',
      description: longDescription,
      default_config: {
        start_prompt: longPrompt
      },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };
    const result = formatJobTypeDetails(jobTypeWithLongText);
    expect(result).toContain('A'.repeat(400) + '…');
    expect(result).toContain('B'.repeat(500) + '…');
  });

  it('should normalize date fields (ms to ISO)', () => {
    const jobTypeWithTimestamps = {
      id: 'timestamps',
      name: 'Timestamp Type',
      org_id: 'org-test',
      created_at: 1704067200000, // 2024-01-01T00:00:00.000Z
      updated_at: 1704153600000  // 2024-01-02T00:00:00.000Z
    };
    const result = formatJobTypeDetails(jobTypeWithTimestamps);
    expect(result).toContain('Created At: 2024-01-01T00:00:00.000Z');
    expect(result).toContain('Updated At: 2024-01-02T00:00:00.000Z');
  });

  it('should handle tags as CSV string', () => {
    const jobTypeWithCSVTags = {
      id: 'csv-tags',
      name: 'CSV Tags Type',
      org_id: 'org-test',
      tags: 'tag1, tag2 , tag3',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };
    const result = formatJobTypeDetails(jobTypeWithCSVTags);
    expect(result).toContain('Tags: tag1, tag2, tag3');
  });

  it('should handle tags as array', () => {
    const jobTypeWithArrayTags = {
      id: 'array-tags',
      name: 'Array Tags Type',
      org_id: 'org-test',
      tags: ['tag1', 'tag2', 'tag3'],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };
    const result = formatJobTypeDetails(jobTypeWithArrayTags);
    expect(result).toContain('Tags: tag1, tag2, tag3');
  });

  it('should summarize large schemas with "+N more" indication', () => {
    const properties: any = {};
    for (let i = 1; i <= 30; i++) {
      properties[`prop${i}`] = { type: 'string', description: `Property ${i}` };
    }
    const jobTypeWithLargeSchema = {
      id: 'large-schema',
      name: 'Large Schema Type',
      org_id: 'org-test',
      params_schema: {
        type: 'object',
        required: ['prop1', 'prop2'],
        properties
      },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };
    const result = formatJobTypeDetails(jobTypeWithLargeSchema);
    expect(result).toContain('Properties: 30');
    expect(result).toContain('+18 more…');
    expect(result).toContain('prop1: string (required)');
    expect(result).toContain('prop12: string');
  });

  it('should return raw JSON on parse failure', () => {
    const invalidJobType = { notAValidField: 123 };
    const result = formatJobTypeDetails(invalidJobType);
    expect(result).toContain('Job Type Details (raw):');
    expect(result).toContain('"notAValidField": 123');
  });

  it('should respect formatter options', () => {
    const result = formatJobTypeDetails(fullJobType, {
      includeSchema: false,
      renderAsMarkdown: false
    });
    expect(result).not.toContain('## Job Type Details');
    expect(result).toContain('Job Type Details\n===========');
    expect(result).not.toContain('Params Schema:');
  });

  it('should handle custom truncation limits', () => {
    const longJobType = {
      id: 'custom-truncate',
      name: 'Custom Truncate',
      org_id: 'org-test',
      description: 'X'.repeat(100),
      default_config: {
        start_prompt: 'Y'.repeat(100)
      },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };
    const result = formatJobTypeDetails(longJobType, {
      truncate: {
        description: 50,
        startPrompt: 30
      }
    });
    expect(result).toContain('X'.repeat(50) + '…');
    expect(result).toContain('Y'.repeat(30) + '…');
  });
});

describe('formatJobTypeSummary', () => {
  it('should format a complete job type summary', () => {
    const jobType = {
      id: 'summary-test',
      name: 'Summary Test Type',
      org_id: 'org-test',
      active: true,
      default_config: {
        max_task_retries: 3,
        task_retry_interval: 15,
        max_time_to_complete: 60,
        failure_cooldown_minutes: 30
      },
      params_schema: {
        type: 'object',
        required: ['field1', 'field2'],
        properties: {
          field1: { type: 'string' },
          field2: { type: 'number' },
          field3: { type: 'boolean' }
        }
      },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };
    const result = formatJobTypeSummary(jobType);
    expect(result).toContain('ID: summary-test');
    expect(result).toContain('Name: Summary Test Type');
    expect(result).toContain('Active: yes');
    expect(result).toContain('Retries: 3 every 15 min');
    expect(result).toContain('Max Time: 60 min');
    expect(result).toContain('Cooldown: 30 min');
    expect(result).toContain('Params: required=2, props=3');
  });

  it('should handle minimal job type summary', () => {
    const minimalJobType = {
      id: 'minimal',
      name: 'Minimal',
      org_id: 'org-test',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z'
    };
    const result = formatJobTypeSummary(minimalJobType);
    expect(result).toContain('ID: minimal');
    expect(result).toContain('Name: Minimal');
    expect(result).toContain('Active: n/a');
    expect(result).toContain('Retries: n/a');
    expect(result).toContain('Max Time: n/a');
    expect(result).toContain('Cooldown: n/a');
    expect(result).toContain('Params: n/a');
  });

  it('should return raw JSON for invalid job type', () => {
    const invalidJobType = { invalid: true };
    const result = formatJobTypeSummary(invalidJobType);
    expect(result).toContain('"invalid": true');
  });
});

import { formatContext } from './formatters.js';

describe('formatContext', () => {
  const localConfig = {
    org_id: 'woba',
    timezone: 'America/Sao_Paulo',
    api_url: 'https://api.aiconnect.cloud/api/v0',
    server_version: '0.4.2'
  };

  it('formats happy path with two job types', () => {
    const result = formatContext({
      localConfig,
      total: 2,
      jobTypes: [
        { id: 'billing-followup', name: 'Billing Follow-up', description: 'Triage de cobrança', emoji: '💳' },
        { id: 'support-triage', name: 'Support Triage', description: 'Roteamento de suporte', emoji: '🛠️' }
      ]
    });
    expect(result).toContain('Context:');
    expect(result).toContain('Org ID:          woba');
    expect(result).toContain('Timezone:        America/Sao_Paulo');
    expect(result).toContain('API URL:         https://api.aiconnect.cloud/api/v0');
    expect(result).toContain('Server version:  0.4.2');
    expect(result).toContain('Job types available (2):');
    expect(result).toContain('billing-followup');
    expect(result).toContain('💳');
    expect(result).toContain('— Triage de cobrança');
  });

  it('handles zero job types', () => {
    const result = formatContext({ localConfig, total: 0, jobTypes: [] });
    expect(result).toContain('Job types available (0):');
    expect(result).toContain('(no job types registered for this org)');
  });

  it('renders error line when jobTypesError present', () => {
    const result = formatContext({
      localConfig,
      jobTypesError: 'API Error (500): Internal Server Error'
    });
    expect(result).toContain('Context:');
    expect(result).toContain('Org ID:          woba');
    expect(result).toContain('Job types: unavailable (error: API Error (500): Internal Server Error)');
    expect(result).not.toContain('Job types available');
  });

  it('preserves alignment when emoji missing', () => {
    const result = formatContext({
      localConfig,
      total: 2,
      jobTypes: [
        { id: 'with-emoji', name: 'With Emoji', emoji: '✅' },
        { id: 'no-emoji', name: 'No Emoji' }
      ]
    });
    const lines = result.split('\n');
    const withEmojiLine = lines.find((l) => l.includes('with-emoji'))!;
    const noEmojiLine = lines.find((l) => l.includes('no-emoji'))!;
    const idxWith = withEmojiLine.indexOf('With Emoji');
    const idxNo = noEmojiLine.indexOf('No Emoji');
    expect(idxWith).toBe(idxNo);
    expect(result).not.toContain('undefined');
    expect(result).not.toContain('null');
  });

  it('shows truncation hint when total > returned items', () => {
    const jobTypes = Array.from({ length: 100 }, (_, i) => ({
      id: `jt-${i}`,
      name: `JT ${i}`
    }));
    const result = formatContext({ localConfig, total: 247, jobTypes });
    expect(result).toContain('Job types available (247):');
    expect(result).toContain('… and 147 more job types not shown');
  });

  it('produces byte-equal output across calls with identical input', () => {
    const input = {
      localConfig,
      total: 1,
      jobTypes: [{ id: 'a', name: 'A', emoji: '🅰️' }]
    };
    const a = formatContext(input);
    const b = formatContext(input);
    expect(a).toBe(b);
  });
});

describe('formatActivityEntry', () => {
  const baseActivity = {
    id: 'act_1',
    org_id: 'org_x',
    activity_type_code: 'ai_completion',
    status: 'completed',
    allocated_credits: 10,
    consumed_credits: 7,
    credits_rule_id: 1,
    created_at: '2026-05-10T12:00:00.000Z',
    updated_at: '2026-05-10T12:00:01.000Z',
    source: { type: 'dispatch' },
  };

  it('renders the basic compact entry', () => {
    const out = formatActivityEntry(baseActivity);
    expect(out).toContain('2026-05-10T12:00:00.000Z');
    expect(out).toContain('[completed]');
    expect(out).toContain('ai_completion');
    expect(out).toContain('via dispatch');
    expect(out).toContain('credits: 7/10');
    expect(out).toContain('id: act_1');
  });

  it('truncates long payload.output to 200 chars with ellipsis', () => {
    const longText = 'x'.repeat(500);
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: longText },
    });
    expect(out).toContain('output: ');
    const lastLine = out.split('\n').find((l) => l.startsWith('  output:'))!;
    expect(lastLine.length).toBeLessThanOrEqual('  output: '.length + 200 + 1);
    expect(lastLine.endsWith('…')).toBe(true);
  });

  it('omits output line entirely when payloads.output is missing', () => {
    const out = formatActivityEntry(baseActivity);
    expect(out).not.toContain('output:');
    expect(out).not.toContain('output: n/a');
  });

  it('renders enriched source extras', () => {
    const out = formatActivityEntry({
      ...baseActivity,
      source: {
        type: 'dispatch',
        reference_id: 'ref-1',
        execution_id: 'exec-1',
      },
    });
    expect(out).toContain('via dispatch (ref: ref-1, exec: exec-1)');
  });

  it('omits absent source extras (no n/a placeholders)', () => {
    const out = formatActivityEntry({
      ...baseActivity,
      source: { type: 'direct' },
    });
    expect(out).toContain('via direct');
    expect(out).not.toContain('n/a');
    expect(out).not.toContain('ref:');
    expect(out).not.toContain('chat:');
  });

  it('falls back to [non-serializable] for cyclic payload', () => {
    const cyclic: any = { foo: 1 };
    cyclic.self = cyclic;
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: cyclic },
    });
    expect(out).toContain('output: [non-serializable]');
  });

  it('falls back to [non-serializable] for Buffer payload', () => {
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: Buffer.from('hello world') },
    });
    expect(out).toContain('output: [non-serializable]');
    expect(out).not.toContain('"type":"Buffer"');
  });

  it('falls back to [non-serializable] for TypedArray payload', () => {
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: new Uint8Array([1, 2, 3, 4]) },
    });
    expect(out).toContain('output: [non-serializable]');
    expect(out).not.toContain('"0":1');
  });

  it('falls back to [non-serializable] for ArrayBuffer payload', () => {
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: new ArrayBuffer(8) },
    });
    expect(out).toContain('output: [non-serializable]');
  });

  it('falls back to [non-serializable] when Buffer is nested inside an object', () => {
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: { attachment: Buffer.from('hello'), kind: 'image' } },
    });
    expect(out).toContain('output: [non-serializable]');
    expect(out).not.toContain('"type":"Buffer"');
    expect(out).not.toContain('"data":[');
  });

  it('falls back to [non-serializable] when TypedArray is deeply nested', () => {
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: {
        output: { wrapper: { items: [{ blob: new Uint8Array([1, 2, 3]) }] } },
      },
    });
    expect(out).toContain('output: [non-serializable]');
  });

  it('falls back to [non-serializable] when Buffer sits inside an array', () => {
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: { items: [Buffer.from('y'), 'plain'] } },
    });
    expect(out).toContain('output: [non-serializable]');
  });

  it('still serializes plain objects when no binary is present at any depth', () => {
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: {
        output: { attachment: 'string-not-buffer', metadata: { id: 1, tags: ['a'] } },
      },
    });
    expect(out).toContain('output: {"attachment":"string-not-buffer","metadata":{"id":1,"tags":["a"]}}');
    expect(out).not.toContain('[non-serializable]');
  });

  it('does not blow up on cyclic objects when scanning for binaries', () => {
    const cyclic: any = { foo: 1 };
    cyclic.self = cyclic;
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: cyclic },
    });
    expect(out).toContain('output: [non-serializable]');
  });

  it('detects Buffer 8 levels deep (no depth cap)', () => {
    const deep: any = {};
    let cursor = deep;
    for (let i = 0; i < 7; i++) {
      cursor.next = {};
      cursor = cursor.next;
    }
    cursor.payload = Buffer.from('deep-secret');
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: deep },
    });
    expect(out).toContain('output: [non-serializable]');
    expect(out).not.toContain('"type":"Buffer"');
    expect(out).not.toContain('"data":[');
  });

  it('detects TypedArray 12 levels deep through arrays and objects', () => {
    let cursor: any = new Uint8Array([42]);
    for (let i = 0; i < 12; i++) {
      cursor = i % 2 === 0 ? [cursor] : { wrap: cursor };
    }
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: cursor },
    });
    expect(out).toContain('output: [non-serializable]');
  });

  it('serializes object payload as JSON', () => {
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: { foo: 'bar', n: 42 } },
    });
    expect(out).toContain('output: {"foo":"bar","n":42}');
  });

  it('returns unparseable hint for malformed activities', () => {
    const out = formatActivityEntry({ wrong: 'shape' });
    expect(out).toContain('[unparseable activity]');
  });

  it('marks as unparseable when status is missing', () => {
    const { status, ...incomplete } = baseActivity;
    void status;
    expect(formatActivityEntry(incomplete)).toContain('[unparseable activity]');
  });

  it('marks as unparseable when activity_type_code is missing', () => {
    const { activity_type_code, ...incomplete } = baseActivity;
    void activity_type_code;
    expect(formatActivityEntry(incomplete)).toContain('[unparseable activity]');
  });

  it('marks as unparseable when source is missing entirely', () => {
    const { source, ...incomplete } = baseActivity;
    void source;
    expect(formatActivityEntry(incomplete)).toContain('[unparseable activity]');
  });

  it('marks as unparseable when source.type is missing', () => {
    expect(
      formatActivityEntry({ ...baseActivity, source: {} })
    ).toContain('[unparseable activity]');
  });

  it('marks as unparseable when source.type is outside the documented enum', () => {
    expect(
      formatActivityEntry({ ...baseActivity, source: { type: 'batch' } })
    ).toContain('[unparseable activity]');
  });

  it('marks as unparseable when allocated_credits or consumed_credits is missing', () => {
    const { allocated_credits, ...noAllocated } = baseActivity;
    void allocated_credits;
    expect(formatActivityEntry(noAllocated)).toContain('[unparseable activity]');

    const { consumed_credits, ...noConsumed } = baseActivity;
    void consumed_credits;
    expect(formatActivityEntry(noConsumed)).toContain('[unparseable activity]');
  });

  it('marks as unparseable when created_at is missing', () => {
    const { created_at, ...incomplete } = baseActivity;
    void created_at;
    expect(formatActivityEntry(incomplete)).toContain('[unparseable activity]');
  });

  it('reproduces the reviewer scenario: { id, source.type } only is unparseable', () => {
    expect(
      formatActivityEntry({ id: 'a1', source: { type: 'dispatch' } })
    ).toContain('[unparseable activity]');
  });

  it('sanitizes multiline content even on the unparseable fallback path', () => {
    // A malformed activity must NOT visually corrupt the surrounding entries.
    // The fallback branch that emits `[unparseable activity]` runs the same
    // newline/CR/tab collapsing as the normal payload path.
    const out = formatActivityEntry('line1\nline2\nline3');
    const lines = out.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('- [unparseable activity] line1\\nline2\\nline3');
  });

  it('truncates oversized content on the unparseable fallback path', () => {
    const huge = 'x'.repeat(1000);
    const out = formatActivityEntry({ junk: huge });
    const lines = out.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0].endsWith('…')).toBe(true);
    // Header + payload must stay within ACTIVITY_OUTPUT_MAX (200) + ellipsis +
    // the literal "- [unparseable activity] " prefix.
    expect(lines[0].length).toBeLessThanOrEqual('- [unparseable activity] '.length + 200 + 1);
  });

  it('marks as unparseable when status is outside the documented enum', () => {
    // The API contract is `submitted | completed | canceled`. Anything else
    // (e.g. "pending") indicates upstream corruption and must fail closed.
    expect(
      formatActivityEntry({ ...baseActivity, status: 'pending' })
    ).toContain('[unparseable activity]');
  });

  it.each(['submitted', 'completed', 'canceled'])(
    'accepts status %s from the documented enum',
    (status) => {
      const out = formatActivityEntry({ ...baseActivity, status });
      expect(out).not.toContain('[unparseable activity]');
      expect(out).toContain(`[${status}]`);
    }
  );

  it('collapses LF newlines in payload.output into a single line', () => {
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: 'line1\nline2\nline3' },
    });
    const outputLines = out.split('\n').filter((l) => l.startsWith('  output:'));
    expect(outputLines).toHaveLength(1);
    expect(outputLines[0]).toBe('  output: line1\\nline2\\nline3');
  });

  it('collapses CRLF and CR newlines into escaped literals', () => {
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: 'a\r\nb\rc' },
    });
    expect(out).toContain('  output: a\\nb\\nc');
    const outputLines = out.split('\n').filter((l) => l.startsWith('  output:'));
    expect(outputLines).toHaveLength(1);
  });

  it('collapses tabs in payload.output', () => {
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: 'col1\tcol2\tcol3' },
    });
    expect(out).toContain('  output: col1\\tcol2\\tcol3');
  });

  it('still truncates after sanitizing multiline output', () => {
    // Each "x\n" pair becomes "x\\n" (3 chars) after sanitizing, so 100 pairs
    // produce 300 visible characters, comfortably above the 200 cap.
    const noisy = 'x\n'.repeat(100);
    const out = formatActivityEntry({
      ...baseActivity,
      payloads: { output: noisy },
    });
    const outputLine = out.split('\n').find((l) => l.startsWith('  output:'))!;
    expect(outputLine.endsWith('…')).toBe(true);
    expect(outputLine).not.toMatch(/\n/); // no actual newlines in the rendered line
  });
});

describe('formatJobActivitiesList', () => {
  const meta = { count: 2, limit: 50, total: 75 };
  const activities = [
    {
      id: 'a1',
      activity_type_code: 'ai_completion',
      status: 'completed',
      allocated_credits: 5,
      consumed_credits: 3,
      created_at: '2026-05-10T10:00:00.000Z',
      updated_at: '2026-05-10T10:00:00.000Z',
      source: { type: 'dispatch' },
    },
    {
      id: 'a2',
      activity_type_code: 'tool_call',
      status: 'submitted',
      allocated_credits: 0,
      consumed_credits: 0,
      created_at: '2026-05-10T10:01:00.000Z',
      updated_at: '2026-05-10T10:01:00.000Z',
      source: { type: 'process_module' },
    },
  ];

  it('renders header, entries, and footer for populated list', () => {
    const out = formatJobActivitiesList('job_x', activities, meta, 0);
    expect(out).toContain('Activities for job job_x (showing 2):');
    expect(out).toContain('id: a1');
    expect(out).toContain('id: a2');
    // Next offset advances by `count` (2), not by `limit` (50), to remain
    // correct when the backend returns a short non-terminal page.
    expect(out).toContain('Returned: 2 | Total matching: 75 | Has more: true | Next offset: 2');
  });

  it('renders empty-state message with full footer', () => {
    const out = formatJobActivitiesList(
      'job_y',
      [],
      { count: 0, limit: 50, total: 0 },
      0
    );
    expect(out).toContain('No activities found for job job_y.');
    expect(out).toContain('Returned: 0 | Total matching: 0 | Has more: false | Next offset: null');
  });

  it('handles pagination overflow (offset beyond total)', () => {
    const out = formatJobActivitiesList(
      'job_z',
      [],
      { count: 0, limit: 50, total: 75 },
      100
    );
    expect(out).toContain('No activities found for job job_z.');
    expect(out).toContain('Returned: 0 | Total matching: 75 | Has more: false | Next offset: null');
  });

  it('throws when meta is missing required numeric fields', () => {
    expect(() =>
      formatJobActivitiesList('job_y', [], { count: 0 } as any, 0)
    ).toThrow(/formatJobActivitiesList: meta is required/);
  });

  it('advances Next offset by returned count, not by limit (short non-terminal page)', () => {
    // The backend ships 10 rows on a page sized 50, with 100 rows still to go.
    // Advancing by `limit` would skip 40 unseen rows; advancing by `count` is
    // safe and correct.
    const out = formatJobActivitiesList(
      'job_x',
      Array.from({ length: 10 }, (_, i) => ({
        id: `a${i}`,
        activity_type_code: 'x',
        status: 'completed',
        allocated_credits: 0,
        consumed_credits: 0,
        created_at: '2026-05-10T10:00:00.000Z',
        updated_at: '2026-05-10T10:00:00.000Z',
        source: { type: 'dispatch' },
      })),
      { count: 10, limit: 50, total: 100 },
      0
    );
    expect(out).toContain('Returned: 10 | Total matching: 100 | Has more: true | Next offset: 10');
  });

  it('advances Next offset by count even when count equals limit', () => {
    const out = formatJobActivitiesList(
      'job_x',
      Array.from({ length: 50 }, (_, i) => ({
        id: `a${i}`,
        activity_type_code: 'x',
        status: 'completed',
        allocated_credits: 0,
        consumed_credits: 0,
        created_at: '2026-05-10T10:00:00.000Z',
        updated_at: '2026-05-10T10:00:00.000Z',
        source: { type: 'dispatch' },
      })),
      { count: 50, limit: 50, total: 200 },
      50
    );
    // offset=50 + count=50 = 100, which equals limit-based math, so this case
    // is unchanged from the prior behavior — but anchored as a regression.
    expect(out).toContain('Returned: 50 | Total matching: 200 | Has more: true | Next offset: 100');
  });
});

describe('formatJobDetails with Activities', () => {
  const baseJob = {
    job_id: 'job_a',
    job_type_id: 'type_a',
    org_id: 'org_a',
    channel_code: 'ch_a',
    job_status: 'completed',
    created_at: '2026-05-10T10:00:00.000Z',
    updated_at: '2026-05-10T10:30:00.000Z',
  };

  it('omits Activities block when field is absent', () => {
    const out = formatJobDetails(baseJob);
    expect(out).not.toContain('Activities:');
  });

  it('renders Activities block only when overlay was requested (meta.activities_meta present)', () => {
    const validActivity = {
      id: 'a1',
      activity_type_code: 'ai_completion',
      status: 'completed',
      allocated_credits: 1,
      consumed_credits: 1,
      created_at: '2026-05-10T10:05:00.000Z',
      updated_at: '2026-05-10T10:05:00.000Z',
      source: { type: 'dispatch' },
    };
    // With the signal: block renders.
    const withMeta = formatJobDetails(
      { ...baseJob, Activities: [validActivity] },
      { activities_meta: { count: 1, limit: 50 } }
    );
    expect(withMeta).toContain('Activities:');
    expect(withMeta).toContain('id: a1');
    // Without the signal: block omitted, even though Activities is populated.
    const withoutMeta = formatJobDetails({ ...baseJob, Activities: [validActivity] });
    expect(withoutMeta).not.toContain('Activities:');
    expect(withoutMeta).not.toContain('id: a1');
  });

  it('omits Activities block when payload leaks Activities but overlay was not requested (fail-closed)', () => {
    // Backend leaks the field without the caller asking — formatter must keep
    // the flag-off output byte-identical to the legacy formatter.
    const baseline = formatJobDetails(baseJob);
    const withLeakedActivities = formatJobDetails({
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
    });
    expect(withLeakedActivities).toBe(baseline);
    expect(withLeakedActivities).not.toContain('Activities:');
  });

  it('shows truncation warning when count > limit', () => {
    const out = formatJobDetails(
      {
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
      { activities_meta: { count: 200, limit: 50 } }
    );
    expect(out).toContain('(showing 1 of 200 activities — use get_job_activities for full pagination)');
  });

  it('omits truncation warning when count <= limit', () => {
    const out = formatJobDetails(
      {
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
      { activities_meta: { count: 12, limit: 50 } }
    );
    expect(out).not.toContain('use get_job_activities for full pagination');
  });

  it('signals empty Activities block when overlay was requested but job has none', () => {
    const out = formatJobDetails(
      baseJob,
      { activities_meta: { count: 0, limit: 50 } }
    );
    expect(out).toContain('Activities:');
    expect(out).toContain('(no activities recorded for this job)');
  });

  it('renders mixed valid + malformed Activities without falling back to raw JSON', () => {
    // One malformed activity must NOT collapse the entire job document into the
    // `Job Details (raw):` branch. The valid activity renders normally, the
    // malformed one degrades to `[unparseable activity]`, and the rest of the
    // formatted job (Identification, Channel, Type Config, etc.) is preserved.
    const out = formatJobDetails(
      {
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
          { id: 'a2', source: { type: 'dispatch' } }, // malformed: missing required fields
        ],
      },
      { activities_meta: { count: 2, limit: 50 } }
    );
    expect(out).not.toContain('Job Details (raw):');
    expect(out).toContain('Job ID: job_a');
    expect(out).toContain('id: a1');
    expect(out).toContain('[unparseable activity]');
  });

  it('preserves byte-identical output when no meta is passed (flag-off regression)', () => {
    const before = formatJobDetails(baseJob);
    const after = formatJobDetails(baseJob, undefined);
    expect(after).toBe(before);
    expect(before).not.toContain('Activities:');
    expect(before).not.toContain('(no activities recorded');
  });

  it('preserves byte-identical output when meta is empty object (no activities_meta)', () => {
    const baseline = formatJobDetails(baseJob);
    const out = formatJobDetails(baseJob, {});
    expect(out).toBe(baseline);
    expect(out).not.toContain('Activities:');
  });
});

describe('formatJobSummary activities counting', () => {
  const job = {
    job_id: 'j1',
    channel_code: 'ch1',
    created_at: '2026-05-10T10:00:00.000Z',
    updated_at: '2026-05-10T10:00:00.000Z',
    scheduled_at: '2026-05-10T09:55:00.000Z',
    job_status: 'completed',
    result: null,
    job_type_id: 't1',
  };

  it('shows total when activities_count exists and overlay is absent', () => {
    const out = formatJobList([{ ...job, activities_count: 347 }], { count: 1, limit: 20, total: 1 }, 0);
    expect(out).toContain('Activities: 347');
    expect(out).not.toContain('overlay:');
  });

  it('prefers activities_count over Activities.length and surfaces the overlay cap (flag-on)', () => {
    const overlay = Array.from({ length: 15 }, (_, i) => ({ id: `a${i}` }));
    const out = formatJobList(
      [{ ...job, activities_count: 347, Activities: overlay }],
      { count: 1, limit: 20, total: 1 },
      0,
      { includeActivities: true }
    );
    expect(out).toContain('Activities: 347 (overlay: 15)');
  });

  it('surfaces divergence when overlay is larger than activities_count (flag-on backend mismatch)', () => {
    const overlay = Array.from({ length: 7 }, (_, i) => ({ id: `a${i}` }));
    const out = formatJobList(
      [{ ...job, activities_count: 5, Activities: overlay }],
      { count: 1, limit: 20, total: 1 },
      0,
      { includeActivities: true }
    );
    expect(out).toContain('Activities: 5 (overlay: 7)');
  });

  it('falls back to Activities.length when activities_count is missing (flag-on)', () => {
    const overlay = [{ id: 'a1' }, { id: 'a2' }];
    const out = formatJobList(
      [{ ...job, Activities: overlay }],
      { count: 1, limit: 20, total: 1 },
      0,
      { includeActivities: true }
    );
    expect(out).toContain('Activities: 2');
    expect(out).not.toContain('overlay:');
  });

  it('omits the activities line when neither field is present', () => {
    const out = formatJobList([job], { count: 1, limit: 20, total: 1 }, 0);
    expect(out).not.toContain('Activities:');
  });

  it('shows just the count (no overlay parens) when overlay matches activities_count', () => {
    const overlay = [{ id: 'a1' }, { id: 'a2' }];
    const out = formatJobList(
      [{ ...job, activities_count: 2, Activities: overlay }],
      { count: 1, limit: 20, total: 1 },
      0,
      { includeActivities: true }
    );
    expect(out).toContain('Activities: 2');
    expect(out).not.toContain('overlay:');
  });

  it('flag-off ignores leaked Activities array entirely (line omitted when no activities_count)', () => {
    // Backend leaks Activities into the payload without the caller asking. The
    // overlay must NOT influence the summary — and with no `activities_count`,
    // the line is omitted entirely.
    const out = formatJobList(
      [{ ...job, Activities: [{ id: 'leaked' }] }],
      { count: 1, limit: 20, total: 1 },
      0
      // no options arg → includeActivities is undefined → flag-off
    );
    expect(out).not.toContain('Activities:');
    expect(out).not.toContain('id: leaked');
  });

  it('flag-off shows activities_count only, never the overlay-divergence suffix', () => {
    // `activities_count` is always-on (server-maintained, not gated), but the
    // overlay-divergence suffix `(overlay: N)` must NOT appear without the flag.
    const out = formatJobList(
      [{ ...job, activities_count: 5, Activities: [{ id: 'leaked' }] }],
      { count: 1, limit: 20, total: 1 },
      0
      // no options arg → flag-off
    );
    expect(out).toContain('Activities: 5');
    expect(out).not.toContain('overlay:');
    expect(out).not.toContain('id: leaked');
  });

  it('flag-on still renders the overlay-divergence suffix when count and overlay differ', () => {
    const overlay = Array.from({ length: 15 }, (_, i) => ({ id: `a${i}` }));
    const out = formatJobList(
      [{ ...job, activities_count: 347, Activities: overlay }],
      { count: 1, limit: 20, total: 1 },
      0,
      { includeActivities: true }
    );
    expect(out).toContain('Activities: 347 (overlay: 15)');
  });
});

describe('formatJobList with activities_truncated', () => {
  const job = {
    job_id: 'j1',
    channel_code: 'ch1',
    created_at: '2026-05-10T10:00:00.000Z',
    updated_at: '2026-05-10T10:00:00.000Z',
    scheduled_at: '2026-05-10T09:55:00.000Z',
    job_status: 'completed',
    result: null,
    job_type_id: 't1',
  };

  it('appends truncation footer line when activities_truncated=true and includeActivities option is on', () => {
    const out = formatJobList(
      [job],
      {
        count: 1,
        limit: 20,
        total: 1,
        activities_truncated: true,
        activities_total_returned: 45,
        activities_total_available: 120,
      },
      0,
      { includeActivities: true }
    );
    expect(out).toContain('Activities truncated: yes (returned 45 of 120 available)');
  });

  it('omits truncation line when activities_truncated=true but includeActivities option is off (fail-closed)', () => {
    // Even if the backend leaks `activities_truncated: true` without the caller
    // requesting activities, the footer must not show the line.
    const out = formatJobList(
      [job],
      {
        count: 1,
        limit: 20,
        total: 1,
        activities_truncated: true,
        activities_total_returned: 45,
        activities_total_available: 120,
      },
      0,
      { includeActivities: false }
    );
    expect(out).not.toContain('Activities truncated:');
  });

  it('omits truncation line when options arg is omitted entirely', () => {
    const out = formatJobList(
      [job],
      { count: 1, limit: 20, total: 1, activities_truncated: true },
      0
    );
    expect(out).not.toContain('Activities truncated:');
  });

  it('does not include truncation line when activities_truncated=false', () => {
    const out = formatJobList(
      [job],
      { count: 1, limit: 20, total: 1, activities_truncated: false },
      0,
      { includeActivities: true }
    );
    expect(out).not.toContain('Activities truncated:');
  });

  it('does not include truncation line when flag is absent', () => {
    const out = formatJobList(
      [job],
      { count: 1, limit: 20, total: 1 },
      0,
      { includeActivities: true }
    );
    expect(out).not.toContain('Activities truncated:');
  });

  it('uses ? placeholder when truncated=true but counters are missing', () => {
    const out = formatJobList(
      [job],
      { count: 1, limit: 20, total: 1, activities_truncated: true },
      0,
      { includeActivities: true }
    );
    expect(out).toContain('Activities truncated: yes (returned ? of ? available)');
  });

  it('renders activities count inline when job has activities_count', () => {
    const out = formatJobList(
      [{ ...job, activities_count: 7 }],
      { count: 1, limit: 20, total: 1 },
      0
    );
    expect(out).toContain('Activities: 7');
  });
});
