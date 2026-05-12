import { z } from "zod";

// Aceita string ISO ou number (timestamp) e converte para string ISO amigável
const isoOrMs = z.union([z.string(), z.number()]).optional();
const toIso = (v: any): string | undefined => {
  if (v === null || v === undefined) return undefined;
  try {
    if (typeof v === 'string') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? v : d.toISOString();
    }
    if (typeof v === 'number') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? String(v) : d.toISOString();
    }
    return String(v);
  } catch {
    return String(v);
  }
};

const taskSchema = z.object({
  task_id: z.string(),
  created_at: isoOrMs,
}).passthrough();

const flagsSchema = z.object({
  is_new_channel: z.boolean().optional(),
  has_human_reply: z.boolean().optional(),
  first_reply_at: isoOrMs.nullable().optional(),
  ignore_cooldown: z.boolean().optional(),
}).passthrough();

const channelDataSchema = z.object({
  org_id: z.string().optional(),
  channel_code: z.string().optional(),
  channel_id: z.string().optional(),
  platform: z.string().optional(),
  name: z.string().optional(),
  profile_id: z.string().optional(),
  thread_id: z.string().optional(),
}).passthrough();

const jobConfigSchema = z.object({
  profile_id: z.string().optional(),
  max_follow_ups: z.number().optional(),
  max_task_retries: z.number().optional(),
  task_retry_interval: z.number().optional(), // minutos
  max_time_to_complete: z.number().optional(), // minutos
  failure_cooldown_minutes: z.number().optional(),
  start_prompt: z.string().optional(),
}).passthrough();

const activitySourceSchema = z.object({
  type: z.enum(['dispatch', 'process_module', 'direct']),
  reference_id: z.string().optional(),
  execution_id: z.string().optional(),
  job_id: z.string().optional(),
  chat_id: z.string().optional(),
  agent_job_type_id: z.string().optional(),
  channel_code: z.string().optional(),
}).passthrough();

// Required-by-contract (per `job-activities-query` spec): every activity entry
// rendered by the formatter MUST surface id, created_at, status, activity_type_code,
// source.type, consumed_credits, allocated_credits. Records missing any of these
// fail the parse and fall back to "[unparseable activity]" so upstream audit-data
// corruption is surfaced rather than silently rendered as `unknown`/`n/a`.
const activitySchema = z.object({
  id: z.string().min(1),
  org_id: z.string().optional(),
  activity_type_code: z.string().min(1),
  status: z.enum(['submitted', 'completed', 'canceled']),
  allocated_credits: z.number(),
  consumed_credits: z.number(),
  credits_rule_id: z.number().optional(),
  payloads: z.object({
    input: z.any().optional(),
    output: z.any().optional(),
  }).passthrough().optional(),
  processed_at: isoOrMs.nullable().optional(),
  created_at: z.union([z.string(), z.number()]),
  updated_at: isoOrMs,
  source: activitySourceSchema,
}).passthrough();

const jobDetailsSchema = z.object({
  job_id: z.string(),
  job_type_id: z.string(),
  org_id: z.string(),
  channel_code: z.string(),
  chat_id: z.string().optional(),
  job_status: z.string(),
  result: z.string().nullable().optional(),
  created_at: isoOrMs,
  updated_at: isoOrMs,
  scheduled_at: isoOrMs.optional(),
  last_task_created_at: isoOrMs.nullable().optional(),
  tags: z.string().optional(),
  execution_log: z.array(z.string()).optional(),
  tasks: z.array(taskSchema).optional().default([]),
  flags: flagsSchema.optional().default({}),
  channel_data: channelDataSchema.optional().default({}),
  job_config: jobConfigSchema.optional().default({}),
  params: z.record(z.any()).optional().default({}),
  activities_count: z.number().optional(),
  // Activities are intentionally validated as `unknown[]` here (not as
  // `z.array(activitySchema)`): per-entry parsing happens inside
  // `formatActivityEntry`, so a single malformed record degrades to
  // "[unparseable activity]" without making the whole job document fall back
  // to the raw-JSON branch in formatJobDetails.
  Activities: z.array(z.unknown()).optional(),
}).passthrough();

const bool = (v: any) => (v === true ? 'yes' : v === false ? 'no' : 'n/a');
const safe = (v: any, fallback: string = 'n/a') =>
  v === undefined || v === null || v === '' ? fallback : String(v);
const truncate = (s: any, max = 300) => {
  if (typeof s !== 'string') return s;
  return s.length > max ? `${s.slice(0, max)}…` : s;
};
const fmtList = (arr?: string[] | null) => (arr && arr.length ? arr.join(', ') : 'n/a');

const ACTIVITY_OUTPUT_MAX = 200;

function isBinaryValue(value: unknown): boolean {
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return true;
  if (value instanceof ArrayBuffer) return true;
  if (typeof ArrayBuffer.isView === 'function' && ArrayBuffer.isView(value as any)) return true;
  return false;
}

function containsBinary(value: unknown, seen: WeakSet<object> = new WeakSet()): boolean {
  if (isBinaryValue(value)) return true;
  if (value === null || typeof value !== 'object') return false;
  if (seen.has(value as object)) return false;
  seen.add(value as object);
  if (Array.isArray(value)) {
    for (const v of value) {
      if (containsBinary(v, seen)) return true;
    }
    return false;
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (containsBinary(v, seen)) return true;
  }
  return false;
}

function safeStringifyOutput(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (containsBinary(value)) return '[non-serializable]';
  try {
    const text = JSON.stringify(value);
    return text === undefined ? '[non-serializable]' : text;
  } catch {
    return '[non-serializable]';
  }
}

/**
 * Collapses newlines/CR/tabs into escaped literals and clamps the result so it
 * always fits in a single visual line of the activity output. Used by every
 * code path that injects user-controlled activity content into the rendered
 * line — both the normal `payloads.output` branch and the malformed-entry
 * fallback — so a bad record cannot visually corrupt the surrounding entries.
 */
function sanitizeForActivityLine(value: string, max: number = ACTIVITY_OUTPUT_MAX): string {
  const escaped = value
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\t/g, '\\t');
  return escaped.length > max ? `${escaped.slice(0, max)}…` : escaped;
}

function formatActivitySource(source: any): string {
  if (!source || typeof source !== 'object') return 'unknown';
  const type = source.type ?? 'unknown';
  const extras: string[] = [];
  if (source.reference_id) extras.push(`ref: ${source.reference_id}`);
  if (source.execution_id) extras.push(`exec: ${source.execution_id}`);
  if (source.chat_id) extras.push(`chat: ${source.chat_id}`);
  if (source.agent_job_type_id) extras.push(`type: ${source.agent_job_type_id}`);
  if (source.channel_code) extras.push(`channel: ${source.channel_code}`);
  return extras.length ? `${type} (${extras.join(', ')})` : String(type);
}

export function formatActivityEntry(activity: unknown): string {
  let a: z.infer<typeof activitySchema>;
  try {
    a = activitySchema.parse(activity);
  } catch {
    const raw = safeStringifyOutput(activity);
    return `- [unparseable activity] ${sanitizeForActivityLine(raw)}`;
  }

  const createdIso = toIso(a.created_at) ?? 'n/a';
  const status = a.status ?? 'unknown';
  const typeCode = a.activity_type_code ?? 'unknown';
  const sourceLine = formatActivitySource(a.source);
  const consumed = a.consumed_credits ?? 0;
  const allocated = a.allocated_credits ?? 0;

  const lines = [
    `- ${createdIso} [${status}] ${typeCode} via ${sourceLine}`,
    `  credits: ${consumed}/${allocated}  id: ${a.id}`,
  ];

  const output = a.payloads?.output;
  if (output !== undefined && output !== null && output !== '') {
    const stringified = safeStringifyOutput(output);
    if (stringified !== '') {
      lines.push(`  output: ${sanitizeForActivityLine(stringified)}`);
    }
  }

  return lines.join('\n');
}

export interface ActivitiesMeta {
  count?: number;
  limit?: number;
  total?: number;
}

export interface JobActivitiesListMeta extends ActivitiesMeta {
  count: number;
  limit: number;
  total: number;
}

export function formatJobActivitiesList(
  jobId: string,
  activities: unknown[],
  meta: JobActivitiesListMeta,
  offset: number = 0
): string {
  if (!meta || typeof meta.count !== 'number' || typeof meta.limit !== 'number' || typeof meta.total !== 'number') {
    throw new Error(
      'formatJobActivitiesList: meta is required with numeric `count`, `limit`, and `total`. ' +
      `Received: ${JSON.stringify(meta)}`
    );
  }

  const safeActivities = activities || [];
  const { count, total } = meta;
  const hasMore = (offset + count) < total;
  // Advance by the number of rows actually returned, not by `limit`. If the
  // backend ships a short non-terminal page (count < limit), advancing by
  // `limit` would tell the caller to skip unseen rows.
  const nextOffset = hasMore ? offset + count : null;
  const footer = `Returned: ${count} | Total matching: ${total} | Has more: ${hasMore} | Next offset: ${nextOffset === null ? 'null' : nextOffset}`;

  if (safeActivities.length === 0) {
    return `No activities found for job ${jobId}.\n\n${footer}`;
  }

  const entries = safeActivities.map(formatActivityEntry).join('\n');
  return `Activities for job ${jobId} (showing ${count}):\n\n${entries}\n\n${footer}`;
}

export function formatJobDetails(job: unknown, meta?: { activities_meta?: ActivitiesMeta }): string {
  try {
    const j = jobDetailsSchema.parse(job);

    // Derivados
    const tasks = j.tasks || [];
    const retriesUsed = Math.max((tasks.length || 0) - 1, 0);
    const maxRetries = j.job_config?.max_task_retries ?? undefined;
    const retriesRemaining = maxRetries !== undefined ? Math.max(maxRetries - retriesUsed, 0) : undefined;

    const createdIso = toIso(j.created_at);
    const updatedIso = toIso(j.updated_at);
    const scheduledIso = toIso(j.scheduled_at);
    const lastTaskIso = toIso(j.last_task_created_at);
    const firstReplyIso = toIso(j.flags?.first_reply_at);

    // Duração aproximada
    let durationLine = 'n/a';
    try {
      const start = scheduledIso ? new Date(scheduledIso).getTime() : createdIso ? new Date(createdIso).getTime() : NaN;
      const end = updatedIso ? new Date(updatedIso).getTime() : Date.now();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        const ms = end - start;
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        durationLine = `${mins}m ${secs}s`;
      }
    } catch {
      // ignore errors
    }

    // Tags em lista
    const tagsList = j.tags ? j.tags.split(',').map(s => s.trim()).filter(Boolean) : [];

    // Tarefas formatadas (mostra as últimas 5)
    const lastTasks = tasks.slice(-5).map((t, i) => `  - [${i + Math.max(tasks.length - 5 + 1, 1)}] ${t.task_id} @ ${safe(toIso(t.created_at))}`);

    // Exec log (últimas 5 linhas)
    const lastLogs = (j.execution_log || []).slice(-5).map((l) => `  - ${l}`);

    // Params (pretty JSON, truncado para visualização)
    const paramsPretty = (() => {
      try {
        const text = JSON.stringify(j.params ?? {}, null, 2);
        return truncate(text, 1500);
      } catch {
        return String(j.params);
      }
    })();

    const startPrompt = j.job_config?.start_prompt ? truncate(j.job_config.start_prompt, 500) : undefined;

    // Fail-closed: the only signal that the caller actually requested the
    // overlay is `meta.activities_meta` (a field the backend returns ONLY for
    // ?include=activities). Without that signal we omit the Activities block
    // entirely — even if `j.Activities` happens to be populated in the payload —
    // to keep flag-off output byte-identical to the legacy formatter.
    let activitiesBlock = '';
    const overlayRequested = meta?.activities_meta !== undefined;
    if (overlayRequested) {
      if (Array.isArray(j.Activities) && j.Activities.length > 0) {
        const entries = j.Activities.map(formatActivityEntry).join('\n');
        const total = meta?.activities_meta?.count;
        const limit = meta?.activities_meta?.limit;
        const truncationLine = (typeof total === 'number' && typeof limit === 'number' && total > limit)
          ? `\n(showing ${j.Activities.length} of ${total} activities — use get_job_activities for full pagination)`
          : '';
        activitiesBlock = `\n\nActivities:\n${entries}${truncationLine}`;
      } else {
        activitiesBlock = `\n\nActivities:\n  - (no activities recorded for this job)`;
      }
    }

    return (
`Job Details
===========

Identification:
- Job ID: ${j.job_id}
- Status: ${j.job_status}
- Org ID: ${j.org_id}
- Channel Code: ${j.channel_code}
- Chat ID: ${safe(j.chat_id)}
- Job Type: ${j.job_type_id}

Channel:
- Platform: ${safe(j.channel_data?.platform)}
- Channel ID: ${safe(j.channel_data?.channel_id)}
- Name: ${safe(j.channel_data?.name)}
- Profile ID: ${safe(j.channel_data?.profile_id)}
- Thread ID: ${safe(j.channel_data?.thread_id)}

Type Config:
- Profile ID: ${safe(j.job_config?.profile_id)}
- Max Follow-ups: ${safe(j.job_config?.max_follow_ups)}
- Max Task Retries: ${safe(j.job_config?.max_task_retries)}
- Task Retry Interval: ${safe(j.job_config?.task_retry_interval)} min
- Max Time to Complete: ${safe(j.job_config?.max_time_to_complete)} min
- Failure Cooldown: ${safe(j.job_config?.failure_cooldown_minutes)} min
- Start Prompt: ${safe(startPrompt)}

Flags:
- is_new_channel: ${bool(j.flags?.is_new_channel)}
- has_human_reply: ${bool(j.flags?.has_human_reply)}
- first_reply_at: ${safe(firstReplyIso)}
- ignore_cooldown: ${bool(j.flags?.ignore_cooldown)}

Params:
${paramsPretty}

Tasks:
- Total Tasks: ${tasks.length}
- Retries Used: ${retriesUsed}${maxRetries !== undefined ? ` / ${maxRetries} (remaining: ${retriesRemaining})` : ''}
${lastTasks.length ? lastTasks.join('\n') : '  - n/a'}

Dates:
- Created At: ${safe(createdIso)}
- Updated At: ${safe(updatedIso)}
- Scheduled At: ${safe(scheduledIso)}
- Last Task At: ${safe(lastTaskIso)}
- Duration: ${durationLine}

Result / Tags / Log:
- Result: ${safe(j.result)}
- Tags: ${fmtList(tagsList)}
- Execution Log (last 5):
${lastLogs.length ? lastLogs.join('\n') : '  - n/a'}${activitiesBlock}
`
    ).trim();
  } catch (e) {
    // Se a validação flexível ainda assim falhar, retorna JSON completo
    return `Job Details (raw):\n\n${JSON.stringify(job, null, 2)}`;
  }
}

// Schema para um job individual, baseado no exemplo fornecido.
const jobSchema = z.object({
  job_id: z.string(),
  channel_code: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  scheduled_at: z.string().datetime(),
  job_status: z.string(),
  result: z.string().nullable(),
  job_type_id: z.string(),
  activities_count: z.number().optional(),
  Activities: z.array(z.any()).optional(),
}).passthrough(); // .passthrough() permite outros campos não definidos no schema.

export interface FormatJobSummaryOptions {
  /**
   * Whether the caller invoked the parent tool with `include_activities=true`.
   * Mirrors the same fail-closed contract used by `formatJobList` /
   * `formatJobDetails`: a backend that leaks the `Activities` overlay array
   * without the caller asking must NOT alter the rendered summary. The
   * `activities_count` field is always-on (server-maintained) and is shown
   * regardless of this flag — only the overlay array is gated.
   */
  includeActivities?: boolean;
}

/**
 * Formata um resumo de um job, com os campos principais.
 */
export function formatJobSummary(job: unknown, options: FormatJobSummaryOptions = {}): string {
  try {
    const parsedJob = jobSchema.parse(job);
    const overlayConsidered = options.includeActivities === true && Array.isArray(parsedJob.Activities);
    const overlayLen = overlayConsidered ? (parsedJob.Activities as unknown[]).length : undefined;
    const totalCount = typeof parsedJob.activities_count === 'number' ? parsedJob.activities_count : undefined;
    let activitiesLine = '';
    if (totalCount !== undefined && overlayLen !== undefined && overlayLen !== totalCount) {
      // Surface any divergence between the canonical total and the overlay size,
      // not just the truncation direction (overlay < total). A backend bug that
      // returns more overlay entries than the canonical count is also a real
      // mismatch the caller should see.
      activitiesLine = `\n- Activities: ${totalCount} (overlay: ${overlayLen})`;
    } else if (totalCount !== undefined) {
      activitiesLine = `\n- Activities: ${totalCount}`;
    } else if (overlayLen !== undefined) {
      activitiesLine = `\n- Activities: ${overlayLen}`;
    }
    return `
- Job ID: ${parsedJob.job_id}
- Status: ${parsedJob.job_status}
- Type: ${parsedJob.job_type_id}
- Channel: ${parsedJob.channel_code}
- Scheduled At: ${parsedJob.scheduled_at}
- Updated At: ${parsedJob.updated_at}
- Result: ${parsedJob.result || 'N/A'}${activitiesLine}
    `.trim();
  } catch {
    // Se a validação falhar, retorna o objeto como string.
    return JSON.stringify(job, null, 2);
  }
}

export interface JobListMeta {
  count: number;
  limit: number;
  total: number;
  activities_total_returned?: number;
  activities_total_available?: number;
  activities_truncated?: boolean;
}

/**
 * Formata a resposta para a lista de jobs.
 *
 * `meta` é obrigatório e os três campos (`count`, `limit`, `total`) precisam
 * ser numéricos — confirmado empiricamente que o backend sempre os retorna em
 * `/services/agent-jobs`. Falha explícita aqui é preferível a inventar um
 * footer com valores inferidos, pois isso recriaria a ambiguidade
 * "page count vs total" que esta tool deveria eliminar.
 *
 * @param jobs - Um array de jobs.
 * @param meta - O objeto `meta` retornado pelo backend.
 * @param offset - O `offset` que a tool enviou na requisição (default 0).
 * @returns Uma string formatada com a lista de resumos de jobs.
 */
export interface FormatJobListOptions {
  /**
   * Whether the caller invoked `list_jobs` with `include_activities=true`. The
   * formatter uses this to decide whether to surface activities-related footer
   * lines (currently the global truncation indicator). Without this signal a
   * backend that mistakenly leaks `meta.activities_truncated` would corrupt the
   * footer for callers who never asked for activities.
   */
  includeActivities?: boolean;
}

export function formatJobList(
    jobs: unknown[],
    meta: JobListMeta,
    offset: number = 0,
    options: FormatJobListOptions = {}
): string {
    if (!meta || typeof meta.count !== 'number' || typeof meta.limit !== 'number' || typeof meta.total !== 'number') {
        throw new Error(
            'formatJobList: meta is required with numeric `count`, `limit`, and `total`. ' +
            `Received: ${JSON.stringify(meta)}`
        );
    }

    const safeJobs = jobs || [];
    const { count, limit, total } = meta;
    const hasMore = (offset + count) < total;
    const nextOffset = hasMore ? offset + limit : null;

    let footer = `Returned: ${count} | Total matching: ${total} | Has more: ${hasMore} | Next offset: ${nextOffset === null ? 'null' : nextOffset}`;
    if (options.includeActivities === true && meta.activities_truncated === true) {
        const returned = typeof meta.activities_total_returned === 'number' ? meta.activities_total_returned : '?';
        const available = typeof meta.activities_total_available === 'number' ? meta.activities_total_available : '?';
        footer += `\nActivities truncated: yes (returned ${returned} of ${available} available)`;
    }

    if (safeJobs.length === 0) {
        return `Found 0 jobs.\n\n${footer}`;
    }

    const summaryOpts: FormatJobSummaryOptions = { includeActivities: options.includeActivities === true };
    const jobSummaries = safeJobs.map(job => formatJobSummary(job, summaryOpts)).join('\n\n');
    return `Found ${safeJobs.length} jobs.\n\n${jobSummaries}\n\n${footer}`;
}

// Schema for job type details
const jobTypeSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  default_config: z.object({
    profile_id: z.string().optional(),
    max_follow_ups: z.number().optional(),
    max_task_retries: z.number().optional(),
    task_retry_interval: z.number().optional(),
    max_time_to_complete: z.number().optional(),
    failure_cooldown_minutes: z.number().optional(),
    start_prompt: z.string().optional(),
  }).optional(),
  params_schema: z.any().optional(),
  version: z.union([z.string(), z.number()]).optional(),
  visibility: z.string().optional(),
  active: z.boolean().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  created_at: isoOrMs,
  updated_at: isoOrMs,
}).passthrough();

// Formatter options interface
export interface FormatterOptions {
  includeSchema?: boolean;
  schemaDepth?: number;
  truncate?: {
    startPrompt?: number;
    description?: number;
    schemaString?: number;
  };
  locale?: string;
  renderAsMarkdown?: boolean;
  showEmptySections?: boolean;
}

// Helper to summarize JSON Schema
function summarizeSchema(schema: any, _depth = 1, limit = 12): {
  type: string;
  requiredCount: number;
  propsCount: number;
  properties: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
    default?: any;
  }>;
} {
  if (!schema || typeof schema !== 'object') {
    return {
      type: 'unknown',
      requiredCount: 0,
      propsCount: 0,
      properties: []
    };
  }

  const type = schema.type || 'unknown';
  const required = Array.isArray(schema.required) ? schema.required : [];
  const props = schema.properties || {};
  const propNames = Object.keys(props);

  const properties = propNames.slice(0, limit).map(name => ({
    name,
    type: props[name]?.type || 'any',
    required: required.includes(name),
    description: props[name]?.description,
    default: props[name]?.default
  }));

  return {
    type,
    requiredCount: required.length,
    propsCount: propNames.length,
    properties
  };
}

/**
 * Formats the response for job type details.
 * @param jobType - The job type object.
 * @param options - Formatter options.
 * @returns A formatted string with the job type details.
 */
export function formatJobTypeDetails(jobType: unknown, options: FormatterOptions = {}): string {
  const {
    includeSchema = true,
    schemaDepth = 1,
    truncate: truncateLimits = {},
    renderAsMarkdown = true,
    showEmptySections = false
  } = options;

  const {
    startPrompt: startPromptLimit = 500,
    description: descriptionLimit = 400,
    schemaString: schemaStringLimit = 1500
  } = truncateLimits;

  try {
    const j = jobTypeSchema.parse(jobType);

    // Normalize dates
    const createdIso = toIso(j.created_at);
    const updatedIso = toIso(j.updated_at);

    // Format tags
    const tagsList = (() => {
      if (!j.tags) return [];
      if (typeof j.tags === 'string') {
        return j.tags.split(',').map(s => s.trim()).filter(Boolean);
      }
      return j.tags;
    })();

    // Truncate long texts
    const descriptionText = j.description ? truncate(j.description, descriptionLimit) : undefined;
    const startPromptText = j.default_config?.start_prompt
      ? truncate(j.default_config.start_prompt, startPromptLimit)
      : undefined;

    // Calculate derived fields
    const retryPolicy = j.default_config?.max_task_retries && j.default_config?.task_retry_interval
      ? `${j.default_config.max_task_retries} every ${j.default_config.task_retry_interval} min`
      : undefined;

    const executionWindow = j.default_config?.max_time_to_complete
      ? `${j.default_config.max_time_to_complete} min`
      : undefined;

    const cooldownInfo = j.default_config?.failure_cooldown_minutes
      ? `${j.default_config.failure_cooldown_minutes} min`
      : undefined;

    // Summarize schema
    const schemaSummary = j.params_schema ? summarizeSchema(j.params_schema, schemaDepth) : null;
    const schemaPreview = j.params_schema && includeSchema ? (() => {
      try {
        const text = JSON.stringify(j.params_schema, null, 2);
        return truncate(text, schemaStringLimit);
      } catch {
        return 'Unable to serialize schema';
      }
    })() : null;

    // Build policies line
    const policies = [
      retryPolicy ? `retries up to ${retryPolicy}` : null,
      executionWindow ? `window ${executionWindow}` : null,
      cooldownInfo ? `cooldown ${cooldownInfo}` : null
    ].filter(Boolean).join(' | ');

    // Format output
    const title = renderAsMarkdown ? '## Job Type Details\n' : 'Job Type Details\n===========\n';

    let output = title + '\n';

    // Identification
    output += 'Identification:\n';
    output += `- ID: ${j.id}\n`;
    output += `- Name: ${j.name}\n`;
    output += `- Org ID: ${j.org_id}\n`;
    if (j.version !== undefined) output += `- Version: ${safe(j.version)}\n`;
    if (j.visibility !== undefined) output += `- Visibility: ${safe(j.visibility)}\n`;
    if (j.active !== undefined) output += `- Active: ${bool(j.active)}\n`;
    output += '\n';

    // Description
    if (descriptionText || showEmptySections) {
      output += 'Description:\n';
      output += safe(descriptionText) + '\n\n';
    }

    // Default Config
    if (j.default_config || showEmptySections) {
      output += 'Default Config:\n';
      if (j.default_config) {
        const cfg = j.default_config;
        if (cfg.profile_id) output += `- Profile ID: ${cfg.profile_id}\n`;
        if (cfg.max_follow_ups !== undefined) output += `- Max Follow-ups: ${cfg.max_follow_ups}\n`;
        if (cfg.max_task_retries !== undefined) output += `- Max Task Retries: ${cfg.max_task_retries}\n`;
        if (cfg.task_retry_interval !== undefined) output += `- Task Retry Interval: ${cfg.task_retry_interval} min\n`;
        if (cfg.max_time_to_complete !== undefined) output += `- Max Time to Complete: ${cfg.max_time_to_complete} min\n`;
        if (cfg.failure_cooldown_minutes !== undefined) output += `- Failure Cooldown: ${cfg.failure_cooldown_minutes} min\n`;
        if (startPromptText) output += `- Start Prompt: ${startPromptText}\n`;
        if (policies) output += `- Policies: ${policies}\n`;
      } else {
        output += 'n/a\n';
      }
      output += '\n';
    }

    // Params Schema
    if ((schemaSummary && includeSchema) || showEmptySections) {
      output += 'Params Schema:\n';
      if (schemaSummary) {
        output += `- Type: ${schemaSummary.type} | Required: ${schemaSummary.requiredCount} | Properties: ${schemaSummary.propsCount}\n`;
        if (schemaSummary.properties.length > 0) {
          output += '- Properties:\n';
          schemaSummary.properties.forEach(prop => {
            const req = prop.required ? ' (required)' : '';
            const desc = prop.description ? ` — ${truncate(prop.description, 100)}` : '';
            const def = prop.default !== undefined ? ` — Defaults to ${JSON.stringify(prop.default)}` : '';
            output += `  - ${prop.name}: ${prop.type}${req}${desc}${def}\n`;
          });
          if (schemaSummary.propsCount > schemaSummary.properties.length) {
            output += `  - +${schemaSummary.propsCount - schemaSummary.properties.length} more…\n`;
          }
        }
        if (schemaPreview) {
          output += '- Schema preview:\n';
          output += '```json\n' + schemaPreview + '\n```\n';
        }
      } else {
        output += 'n/a\n';
      }
      output += '\n';
    }

    // Metadata
    output += 'Metadata:\n';
    output += `- Created At: ${safe(createdIso)}\n`;
    output += `- Updated At: ${safe(updatedIso)}\n`;
    output += `- Tags: ${fmtList(tagsList)}\n`;

    return output.trim();
  } catch (e) {
    // If validation fails, return raw JSON
    return `Job Type Details (raw):\n\n${JSON.stringify(jobType, null, 2)}`;
  }
}

/**
 * Formats a summary of a job type.
 * @param jobType - The job type object.
 * @returns A formatted string with the job type summary.
 */
export function formatJobTypeSummary(jobType: unknown): string {
  try {
    const j = jobTypeSchema.parse(jobType);

    const retries = j.default_config?.max_task_retries && j.default_config?.task_retry_interval
      ? `${j.default_config.max_task_retries} every ${j.default_config.task_retry_interval} min`
      : 'n/a';

    const maxTime = j.default_config?.max_time_to_complete
      ? `${j.default_config.max_time_to_complete} min`
      : 'n/a';

    const cooldown = j.default_config?.failure_cooldown_minutes
      ? `${j.default_config.failure_cooldown_minutes} min`
      : 'n/a';

    const schemaSummary = j.params_schema ? summarizeSchema(j.params_schema) : null;
    const schemaInfo = schemaSummary
      ? `required=${schemaSummary.requiredCount}, props=${schemaSummary.propsCount}`
      : 'n/a';

    return [
      `- ID: ${j.id}`,
      `- Name: ${j.name}`,
      `- Active: ${bool(j.active)}`,
      `- Retries: ${retries} | Max Time: ${maxTime} | Cooldown: ${cooldown}`,
      `- Params: ${schemaInfo}`
    ].join('\n');
  } catch {
    // If validation fails, return basic info
    return JSON.stringify(jobType, null, 2);
  }
}
const DATE_FILTER_KEYS = [
  'scheduled_at_gte',
  'scheduled_at_lte',
  'created_at_gte',
  'created_at_lte',
] as const;

const renderDateRange = (
  label: string,
  gte: unknown,
  lte: unknown
): string | null => {
  if (gte === undefined && lte === undefined) return null;
  const left = gte !== undefined ? String(gte) : '(open)';
  const right = lte !== undefined ? String(lte) : '(open)';
  return `${label}: ${left} → ${right}`;
};

export interface ContextLocalConfig {
  org_id: string;
  timezone: string;
  api_url: string;
  server_version: string;
}

export interface ContextJobType {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
}

export interface FormatContextInput {
  localConfig: ContextLocalConfig;
  jobTypes?: ContextJobType[];
  total?: number;
  jobTypesError?: string;
}

const CONTEXT_LABEL_WIDTH = 16; // "Server version: " == 16 chars
const JOB_TYPE_ID_WIDTH = 22;
const JOB_TYPE_EMOJI_WIDTH = 4;

function padLabel(label: string): string {
  return (label + ':').padEnd(CONTEXT_LABEL_WIDTH, ' ');
}

function formatJobTypeLine(jt: ContextJobType): string {
  const id = jt.id.padEnd(JOB_TYPE_ID_WIDTH, ' ');
  const emoji = (jt.emoji ?? '').padEnd(JOB_TYPE_EMOJI_WIDTH, ' ');
  const description = jt.description ? ` — ${jt.description}` : '';
  return `  - ${id} ${emoji} ${jt.name}${description}`;
}

export function formatContext(input: FormatContextInput): string {
  const { localConfig, jobTypes, total, jobTypesError } = input;

  const contextSection = [
    'Context:',
    `  ${padLabel('Org ID')} ${localConfig.org_id}`,
    `  ${padLabel('Timezone')} ${localConfig.timezone}`,
    `  ${padLabel('API URL')} ${localConfig.api_url}`,
    `  ${padLabel('Server version')} ${localConfig.server_version}`
  ].join('\n');

  let jobsSection: string;
  if (jobTypesError !== undefined) {
    jobsSection = `Job types: unavailable (error: ${jobTypesError})`;
  } else if (jobTypes === undefined) {
    jobsSection = 'Job types: unavailable (error: unknown)';
  } else {
    const totalCount = typeof total === 'number' ? total : jobTypes.length;
    if (totalCount === 0) {
      jobsSection = 'Job types available (0):\n  (no job types registered for this org)';
    } else {
      const lines = jobTypes.map(formatJobTypeLine);
      let trailing = '';
      if (totalCount > jobTypes.length) {
        const missing = totalCount - jobTypes.length;
        trailing = `\n  … and ${missing} more job types not shown`;
      }
      jobsSection = `Job types available (${totalCount}):\n${lines.join('\n')}${trailing}`;
    }
  }

  return `${contextSection}\n\n${jobsSection}`;
}

export function formatJobStats(
  stats: any,
  appliedFilters: Record<string, any> | null | undefined = {}
): string {
  const {
    waiting = 0,
    running = 0,
    completed = 0,
    failed = 0,
    canceled = 0,
    scheduled = 0,
  } = stats.status;

  const totalJobs = waiting + running + completed + failed + canceled + scheduled;

  const successRate = totalJobs > 0 ? ((completed / (totalJobs - waiting - scheduled - running)) * 100).toFixed(1) : "0.0";
  const completionRate = (completed + failed) > 0 ? (completed / (completed + failed) * 100).toFixed(1) : "0.0";
  const activeJobs = running + waiting + scheduled;

  const filters = appliedFilters || {};
  const scheduledLine = renderDateRange(
    'Scheduled',
    filters.scheduled_at_gte,
    filters.scheduled_at_lte
  );
  const createdLine = renderDateRange(
    'Created',
    filters.created_at_gte,
    filters.created_at_lte
  );
  const hasAnyDateFilter = DATE_FILTER_KEYS.some(
    (k) => filters[k] !== undefined
  );
  const periodFallback = hasAnyDateFilter ? null : 'Period: All time';

  const dateLines = [scheduledLine, createdLine, periodFallback].filter(
    (l): l is string => l !== null
  );

  const dateFilterSet = new Set<string>(DATE_FILTER_KEYS);
  const otherFilterEntries = Object.entries(filters).filter(
    ([k, v]) => !dateFilterSet.has(k) && v !== undefined && v !== null && v !== ''
  );
  const filtersSection = otherFilterEntries.length
    ? `Filters:\n${otherFilterEntries.map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n`
    : '';

  const percentage = (value: number) => {
    if (totalJobs === 0) return "0.0";
    return ((value / totalJobs) * 100).toFixed(1);
  }

  return `
Job Statistics Report
====================

${dateLines.join('\n')}

${filtersSection}Status Breakdown:
✓ Completed:  ${completed} jobs (${percentage(completed)}%)
⏳ Running:     ${running} jobs (${percentage(running)}%)
⏰ Scheduled:  ${scheduled} jobs (${percentage(scheduled)}%)
⏸ Waiting:     ${waiting} jobs (${percentage(waiting)}%)
✗ Failed:      ${failed} jobs (${percentage(failed)}%)
⊘ Canceled:    ${canceled} jobs (${percentage(canceled)}%)

Summary:
- Total Jobs: ${totalJobs}
- Success Rate: ${successRate}%
- Active Jobs: ${activeJobs} (running + waiting + scheduled)
- Completion Rate: ${completionRate}% (completed / (completed + failed))
  `.trim();
}
