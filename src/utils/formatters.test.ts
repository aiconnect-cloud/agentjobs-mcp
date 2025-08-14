import { describe, it, expect } from 'vitest';
import { formatJobDetails, formatJobStats, formatJobTypeDetails, formatJobTypeSummary } from './formatters.js';

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
