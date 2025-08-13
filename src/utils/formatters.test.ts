import { describe, it, expect } from 'vitest';
import { formatJobDetails, formatJobStats } from './formatters.js';

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