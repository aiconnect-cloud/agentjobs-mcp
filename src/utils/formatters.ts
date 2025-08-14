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
}).passthrough();

const bool = (v: any) => (v === true ? 'yes' : v === false ? 'no' : 'n/a');
const safe = (v: any, fallback: string = 'n/a') =>
  v === undefined || v === null || v === '' ? fallback : String(v);
const truncate = (s: any, max = 300) => {
  if (typeof s !== 'string') return s;
  return s.length > max ? `${s.slice(0, max)}…` : s;
};
const fmtList = (arr?: string[] | null) => (arr && arr.length ? arr.join(', ') : 'n/a');

export function formatJobDetails(job: unknown): string {
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
${lastLogs.length ? lastLogs.join('\n') : '  - n/a'}
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
}).passthrough(); // .passthrough() permite outros campos não definidos no schema.

/**
 * Formata um resumo de um job, com os campos principais.
 * @param job - O objeto do job.
 * @returns Uma string formatada com o resumo do job.
 */
export function formatJobSummary(job: unknown): string {
  try {
    const parsedJob = jobSchema.parse(job);
    return `
- Job ID: ${parsedJob.job_id}
- Status: ${parsedJob.job_status}
- Type: ${parsedJob.job_type_id}
- Channel: ${parsedJob.channel_code}
- Scheduled At: ${parsedJob.scheduled_at}
- Updated At: ${parsedJob.updated_at}
- Result: ${parsedJob.result || 'N/A'}
    `.trim();
  } catch {
    // Se a validação falhar, retorna o objeto como string.
    return JSON.stringify(job, null, 2);
  }
}

/**
 * Formata a resposta para a lista de jobs.
 * @param jobs - Um array de jobs.
 * @param pagination - O objeto de paginação.
 * @returns Uma string formatada com a lista de resumos de jobs.
 */
export function formatJobList(jobs: unknown[], pagination: any): string {
    if (!jobs || jobs.length === 0) {
        return "No jobs found for the given criteria.";
    }

    const jobSummaries = jobs.map(job => formatJobSummary(job)).join('\n\n');
    const paginationSummary = `Page: ${Math.floor((pagination.offset || 0) / (pagination.limit || 20)) + 1} | Total Jobs: ${pagination.total}`;

    return `Found ${jobs.length} jobs.\n\n${jobSummaries}\n\n${paginationSummary}`;
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
export function formatJobStats(stats: any, filters: any): string {
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

  let period = "All time";
  if (filters) {
    if (filters.scheduled_at_gte || filters.scheduled_at_lte) {
      const startDate = filters.scheduled_at_gte ? new Date(filters.scheduled_at_gte).toLocaleDateString() : "";
      const endDate = filters.scheduled_at_lte ? new Date(filters.scheduled_at_lte).toLocaleDateString() : "";
      period = `${startDate} to ${endDate}`;
    }
  }

  const org = filters?.org_id ? `Organization: ${filters.org_id}` : "";

  const percentage = (value: number) => {
    if (totalJobs === 0) return "0.0";
    return ((value / totalJobs) * 100).toFixed(1);
  }

  return `
Job Statistics Report
====================

Period: ${period}
${org}

Status Breakdown:
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
