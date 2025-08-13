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
  description: z.string(),
  default_config: z.object({
    profile_id: z.string(),
    max_follow_ups: z.number(),
    max_task_retries: z.number(),
    task_retry_interval: z.number().describe("The interval in minutes to wait before retrying a task."),
    max_time_to_complete: z.number().describe("The maximum time in minutes to complete a task."),
    start_prompt: z.string(),
  }),
}).passthrough();

/**
 * Formats the response for job type details.
 * @param jobType - The job type object.
 * @returns A formatted string with the job type details.
 */
export function formatJobTypeDetails(jobType: unknown): string {
  try {
    const parsedJobType = jobTypeSchema.parse(jobType);
    return `
- ID: ${parsedJobType.id}
- Name: ${parsedJobType.name}
- Description: ${parsedJobType.description}
- Organization ID: ${parsedJobType.org_id}

Default Configuration:
- Profile ID: ${parsedJobType.default_config.profile_id}
- Max Follow-ups: ${parsedJobType.default_config.max_follow_ups}
- Max Task Retries: ${parsedJobType.default_config.max_task_retries}
- Task Retry Interval: ${parsedJobType.default_config.task_retry_interval} minutes
- Max Time to Complete: ${parsedJobType.default_config.max_time_to_complete} minutes
- Start Prompt: ${parsedJobType.default_config.start_prompt}
    `.trim();
  } catch {
    // If validation fails, return the object as a string.
    return `Invalid job type details format: ${JSON.stringify(jobType, null, 2)}`;
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
