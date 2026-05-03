import { randomUUID } from 'node:crypto';
import { logError } from '@/lib/logger';
import { query, withTransaction } from './db';
import { notifyApproachingUsers } from './notifications';

export type PushJobStatus = 'pending' | 'processing' | 'succeeded' | 'failed';
export type PushJobType = 'approaching_users';

export interface PushNotificationJob {
  id: string;
  type: PushJobType;
  run_id: string;
  trigger_stop_id: string;
  payload: Record<string, unknown>;
  status: PushJobStatus;
  attempts: number;
  max_attempts: number;
  available_at: Date;
  locked_at: Date | null;
  locked_by: string | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface PushJobProcessResult {
  claimed: number;
  succeeded: number;
  failed: number;
  jobs: Array<{
    id: string;
    status: 'succeeded' | 'failed';
    retryable: boolean;
    error?: string;
  }>;
}

const DEFAULT_JOB_LIMIT = 10;
const MAX_JOB_LIMIT = 50;
const STALE_LOCK_SECONDS = 5 * 60;
const workerId = `push-worker-${process.pid}-${randomUUID()}`;

export function normalizePushJobLimit(input?: string | null): number {
  if (!input) return DEFAULT_JOB_LIMIT;
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_JOB_LIMIT;
  return Math.min(parsed, MAX_JOB_LIMIT);
}

export function computePushJobRetryDelaySeconds(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(5 * 60, 30 * 2 ** exponent);
}

export async function enqueueApproachingUsersPushJob(
  runId: string,
  triggerStopId: string,
): Promise<PushNotificationJob> {
  const rows = await query<PushNotificationJob>(
    `INSERT INTO notification_push_jobs
       (id, type, run_id, trigger_stop_id, payload, status, available_at,
        created_at, updated_at)
     VALUES
       ($1, 'approaching_users', $2, $3, $4::jsonb, 'pending', NOW(),
        NOW(), NOW())
     ON CONFLICT (type, run_id, trigger_stop_id)
     DO UPDATE SET
       status = CASE
         WHEN notification_push_jobs.status IN ('succeeded', 'processing')
           THEN notification_push_jobs.status
         ELSE 'pending'
       END,
       attempts = CASE
         WHEN notification_push_jobs.status = 'failed' THEN 0
         ELSE notification_push_jobs.attempts
       END,
       available_at = CASE
         WHEN notification_push_jobs.status IN ('succeeded', 'processing')
           THEN notification_push_jobs.available_at
         ELSE NOW()
       END,
       locked_at = CASE
         WHEN notification_push_jobs.status = 'processing'
           THEN notification_push_jobs.locked_at
         ELSE NULL
       END,
       locked_by = CASE
         WHEN notification_push_jobs.status = 'processing'
           THEN notification_push_jobs.locked_by
         ELSE NULL
       END,
       last_error = CASE
         WHEN notification_push_jobs.status IN ('succeeded', 'processing')
           THEN notification_push_jobs.last_error
         ELSE NULL
       END,
       completed_at = CASE
         WHEN notification_push_jobs.status = 'succeeded'
           THEN notification_push_jobs.completed_at
         ELSE NULL
       END,
       updated_at = NOW()
     RETURNING *`,
    [
      randomUUID(),
      runId,
      triggerStopId,
      JSON.stringify({ runId, triggerStopId }),
    ],
  );

  return rows[0]!;
}

async function claimPendingPushJobs(limit: number): Promise<PushNotificationJob[]> {
  return withTransaction(async (client) => {
    const result = await client.query<PushNotificationJob>(
      `WITH candidates AS (
         SELECT id
         FROM notification_push_jobs
         WHERE type = 'approaching_users'
           AND attempts < max_attempts
           AND available_at <= NOW()
           AND (
             status = 'pending'
             OR (
               status = 'processing'
               AND locked_at <= NOW() - ($3::int * INTERVAL '1 second')
             )
           )
         ORDER BY available_at ASC, created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE notification_push_jobs AS job
       SET status = 'processing',
           attempts = job.attempts + 1,
           locked_at = NOW(),
           locked_by = $2,
           updated_at = NOW()
       FROM candidates
       WHERE job.id = candidates.id
       RETURNING job.*`,
      [limit, workerId, STALE_LOCK_SECONDS],
    );
    return result.rows;
  });
}

async function markPushJobSucceeded(jobId: string): Promise<void> {
  await query(
    `UPDATE notification_push_jobs
     SET status = 'succeeded',
         locked_at = NULL,
         locked_by = NULL,
         last_error = NULL,
         completed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [jobId],
  );
}

async function markPushJobFailed(
  job: PushNotificationJob,
  errorMessage: string,
): Promise<boolean> {
  const retryable = job.attempts < job.max_attempts;
  const delaySeconds = computePushJobRetryDelaySeconds(job.attempts);

  await query(
    `UPDATE notification_push_jobs
     SET status = $2,
         locked_at = NULL,
         locked_by = NULL,
         last_error = $3,
         available_at = CASE
           WHEN $4::boolean THEN NOW() + ($5::int * INTERVAL '1 second')
           ELSE available_at
         END,
         completed_at = CASE
           WHEN $4::boolean THEN NULL
           ELSE NOW()
         END,
         updated_at = NOW()
     WHERE id = $1`,
    [
      job.id,
      retryable ? 'pending' : 'failed',
      errorMessage,
      retryable,
      delaySeconds,
    ],
  );

  return retryable;
}

async function processPushNotificationJob(job: PushNotificationJob): Promise<void> {
  if (job.type !== 'approaching_users') {
    throw new Error(`Unsupported push job type: ${job.type}`);
  }

  await notifyApproachingUsers(job.run_id, job.trigger_stop_id);
}

export async function processPushNotificationJobs(
  limit = DEFAULT_JOB_LIMIT,
): Promise<PushJobProcessResult> {
  const jobs = await claimPendingPushJobs(Math.min(limit, MAX_JOB_LIMIT));
  const results: PushJobProcessResult['jobs'] = [];

  for (const job of jobs) {
    try {
      await processPushNotificationJob(job);
      await markPushJobSucceeded(job.id);
      results.push({ id: job.id, status: 'succeeded', retryable: false });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Push job processing failed';
      const retryable = await markPushJobFailed(job, message);
      logError('[push-jobs] processing failed', {
        jobId: job.id,
        runId: job.run_id,
        triggerStopId: job.trigger_stop_id,
        retryable,
        message,
      });
      results.push({
        id: job.id,
        status: 'failed',
        retryable,
        error: message,
      });
    }
  }

  return {
    claimed: jobs.length,
    succeeded: results.filter((result) => result.status === 'succeeded').length,
    failed: results.filter((result) => result.status === 'failed').length,
    jobs: results,
  };
}
