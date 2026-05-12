import { z } from 'zod';

/**
 * Factory that returns a fresh Zod schema validating ISO 8601 date-time strings.
 *
 * Accepts any string parseable by `new Date(value)` (full ISO 8601 with `Z` or
 * timezone offset, and date-only forms like `2024-07-23`).
 *
 * IMPORTANT — why this is a factory and not a singleton: when the MCP SDK
 * serializes a tool's input shape to JSON Schema (via `zod-to-json-schema`),
 * reusing the same Zod *instance* across multiple fields causes the serializer
 * to emit `$ref` from sibling fields back to the first one. Many clients/LLMs
 * then treat those fields as `any` and send `null`, which the server rejects.
 * Returning a new instance per call guarantees inline definitions per field.
 *
 * Convention for this project: every reusable Zod schema referenced by more
 * than one tool field MUST be exported as a factory (`() => z.something(...)`),
 * never as a singleton `const`.
 */
export const flexibleDateTimeSchema = () =>
  z.string().refine((value) => {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }, {
    message: "Invalid date-time string. Please use a valid ISO 8601 format.",
  });

/**
 * Enum factories for activity record fields. Returned as factories for the
 * same reason as `flexibleDateTimeSchema` — singletons would cause `$ref`
 * collisions in the serialized JSON Schema across sibling tool fields.
 */
export const activityStatusSchema = () =>
  z.enum(['submitted', 'completed', 'canceled']);

export const activitySourceTypeSchema = () =>
  z.enum(['dispatch', 'process_module', 'direct']);

export const activitiesSortSchema = () =>
  z.enum(['created_at', '-created_at']);
