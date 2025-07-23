import { describe, it, expect } from 'vitest';
import { flexibleDateTimeSchema } from './schemas.js';

describe('flexibleDateTimeSchema', () => {
  // Test case 1: Valid ISO 8601 with UTC 'Z'
  it('should validate a correct ISO 8601 string with Zulu time', () => {
    const validDate = '2025-07-23T21:00:00Z';
    const result = flexibleDateTimeSchema.safeParse(validDate);
    expect(result.success).toBe(true);
  });

  // Test case 2: Valid ISO 8601 with a positive timezone offset
  it('should validate a correct ISO 8601 string with a positive offset', () => {
    const validDate = '2025-07-23T22:00:00+01:00';
    const result = flexibleDateTimeSchema.safeParse(validDate);
    expect(result.success).toBe(true);
  });

  // Test case 3: Valid ISO 8601 with a negative timezone offset
  it('should validate a correct ISO 8601 string with a negative offset', () => {
    const validDate = '2025-07-23T16:00:00-05:00';
    const result = flexibleDateTimeSchema.safeParse(validDate);
    expect(result.success).toBe(true);
  });

  // Test case 4: Invalid date format (not ISO 8601)
  it('should not validate an incorrect date format', () => {
    const invalidDate = '23/07/2025 21:00:00';
    const result = flexibleDateTimeSchema.safeParse(invalidDate);
    expect(result.success).toBe(false);
  });

  // Test case 5: Invalid date string (gibberish)
  it('should not validate a gibberish string', () => {
    const gibberish = 'not-a-date';
    const result = flexibleDateTimeSchema.safeParse(gibberish);
    expect(result.success).toBe(false);
  });

  // Test case 6: Empty string
  it('should not validate an empty string', () => {
    const emptyString = '';
    const result = flexibleDateTimeSchema.safeParse(emptyString);
    expect(result.success).toBe(false);
  });
});