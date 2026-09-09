/**
 * The BullMQ queues this application owns.
 *
 * These live in their own file rather than in jobs.module.ts so that
 * processors, enqueuers and the schedule table can name a queue without
 * importing the Nest module that provides them — a cycle CommonJS resolves
 * to `undefined` at decorator-evaluation time.
 */
export const QUEUES = {
  TRANSACTION_SYNC: 'transaction-sync',
  SUBSCRIPTION_DETECT: 'subscription-detect',
  ALERTS: 'alerts',
  BACKUP: 'backup',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
