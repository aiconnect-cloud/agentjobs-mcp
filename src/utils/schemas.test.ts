import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { flexibleDateTimeSchema } from './schemas.js';

describe('flexibleDateTimeSchema', () => {
  it('should validate a correct ISO 8601 string with Zulu time', () => {
    const result = flexibleDateTimeSchema().safeParse('2025-07-23T21:00:00Z');
    expect(result.success).toBe(true);
  });

  it('should validate a correct ISO 8601 string with a positive offset', () => {
    const result = flexibleDateTimeSchema().safeParse('2025-07-23T22:00:00+01:00');
    expect(result.success).toBe(true);
  });

  it('should validate a correct ISO 8601 string with a negative offset', () => {
    const result = flexibleDateTimeSchema().safeParse('2025-07-23T16:00:00-05:00');
    expect(result.success).toBe(true);
  });

  it('should not validate an incorrect date format', () => {
    const result = flexibleDateTimeSchema().safeParse('23/07/2025 21:00:00');
    expect(result.success).toBe(false);
  });

  it('should not validate a gibberish string', () => {
    const result = flexibleDateTimeSchema().safeParse('not-a-date');
    expect(result.success).toBe(false);
  });

  it('should not validate an empty string', () => {
    const result = flexibleDateTimeSchema().safeParse('');
    expect(result.success).toBe(false);
  });

  it('should validate a date-only string (no time component)', () => {
    const result = flexibleDateTimeSchema().safeParse('2024-07-23');
    expect(result.success).toBe(true);
  });

  it('should reject invalid string with the exact ISO 8601 error message', () => {
    const result = flexibleDateTimeSchema().safeParse('not-a-date');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Invalid date-time string. Please use a valid ISO 8601 format.'
      );
    }
  });

  it('should reject null when used with .optional() (string | undefined, not nullable)', () => {
    const schema = flexibleDateTimeSchema().optional();
    expect(schema.safeParse(undefined).success).toBe(true);
    const nullResult = schema.safeParse(null);
    expect(nullResult.success).toBe(false);
    if (!nullResult.success) {
      const issue = nullResult.error.issues[0];
      expect(issue.code).toBe('invalid_type');
      // Zod 3: { expected: 'string', received: 'null' }
      expect((issue as unknown as { expected: string }).expected).toBe('string');
      expect((issue as unknown as { received: string }).received).toBe('null');
    }
  });
});

describe('JSON Schema serialization', () => {
  it('should inline each list_jobs date filter field without $ref', () => {
    const shape = z.object({
      scheduled_at: flexibleDateTimeSchema().optional(),
      scheduled_at_gte: flexibleDateTimeSchema().optional(),
      scheduled_at_lte: flexibleDateTimeSchema().optional(),
      created_at_gte: flexibleDateTimeSchema().optional(),
      created_at_lte: flexibleDateTimeSchema().optional(),
    });
    const json = zodToJsonSchema(shape) as {
      properties: Record<string, { type?: string; $ref?: string }>;
    };

    const expectedFields = [
      'scheduled_at',
      'scheduled_at_gte',
      'scheduled_at_lte',
      'created_at_gte',
      'created_at_lte',
    ];

    for (const field of expectedFields) {
      const prop = json.properties[field];
      expect(
        prop.$ref,
        `expected ${field} to be inline, got $ref ${String(prop.$ref)}`
      ).toBeUndefined();
      expect(
        prop.type,
        `expected ${field} to have type 'string', got ${String(prop.type)}`
      ).toBe('string');
    }
  });

  it('should produce $ref-free JSON for both list_jobs and get_jobs_stats shapes', () => {
    const listJobsShape = z.object({
      scheduled_at: flexibleDateTimeSchema().optional(),
      scheduled_at_gte: flexibleDateTimeSchema().optional(),
      scheduled_at_lte: flexibleDateTimeSchema().optional(),
      created_at_gte: flexibleDateTimeSchema().optional(),
      created_at_lte: flexibleDateTimeSchema().optional(),
    });
    const statsShape = z.object({
      scheduled_at_gte: flexibleDateTimeSchema().optional(),
      scheduled_at_lte: flexibleDateTimeSchema().optional(),
      created_at_gte: flexibleDateTimeSchema().optional(),
      created_at_lte: flexibleDateTimeSchema().optional(),
    });

    expect(JSON.stringify(zodToJsonSchema(listJobsShape))).not.toContain('$ref');
    expect(JSON.stringify(zodToJsonSchema(statsShape))).not.toContain('$ref');
  });
});
