import { z } from 'zod';

/**
 * A flexible Zod schema for validating ISO 8601 date-time strings.
 *
 * This schema accepts any string that can be successfully parsed by the `Date` constructor,
 * which includes formats with 'Z' (UTC) and timezone offsets (e.g., '+01:00').
 * It refines a base string schema, providing a more specific error message if the
 * date-time string is invalid.
 */
export const flexibleDateTimeSchema = z.string().refine((value) => {
  // Try to parse the date string.
  // The Date constructor is quite flexible with ISO 8601 formats.
  const date = new Date(value);
  // Check if the parsed date is valid.
  // `isNaN(date.getTime())` is a reliable way to check for invalid dates.
  return !isNaN(date.getTime());
}, {
  // Custom error message for invalid date-time strings.
  message: "Invalid date-time string. Please use a valid ISO 8601 format.",
});
