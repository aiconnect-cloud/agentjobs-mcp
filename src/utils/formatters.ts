import { z } from "zod";

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

type Job = z.infer<typeof jobSchema>;

/**
 * Formata a resposta completa de um job, ideal para o get_job.
 * @param job - O objeto do job.
 * @returns Uma string formatada com os detalhes completos do job.
 */
export function formatJobDetails(job: unknown): string {
  const fullJobDetails = JSON.stringify(job, null, 2);
  return `Job Details:\n\n${fullJobDetails}`;
}

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
  } catch (error) {
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

type JobType = z.infer<typeof jobTypeSchema>;

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
  } catch (error) {
    // If validation fails, return the object as a string.
    return `Invalid job type details format: ${JSON.stringify(jobType, null, 2)}`;
  }
}