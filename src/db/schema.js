import { pgTable, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const workstreams = pgTable('workstreams', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  workstream: text('workstream').notNull(),
  column: text('column').notNull(),
  agentDispatchable: boolean('agent_dispatchable').notNull().default(false),
  priority: text('priority').notNull().default('med'),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const agents = pgTable('agents', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  status: text('status').notNull().default('idle'),
  taskId: text('task_id'),
  startedAt: timestamp('started_at'),
  log: jsonb('log').notNull().default([]),
});
