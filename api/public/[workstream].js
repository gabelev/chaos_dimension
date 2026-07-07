// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { eq, or, desc, inArray } from 'drizzle-orm';
import { getDb } from '../../src/db/client.js';
import { withPublicContext } from '../../src/lib/userContext.js';
import { workstreams, tasks, specs } from '../../src/db/schema.js';
import { checkRateLimit, ipBucket } from '../../src/lib/oauthRateLimit.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';

// Public ledger feed: GET /api/public/:workstream (slug or id).
// Unauthenticated and read-only by construction — every query runs inside
// withPublicContext, where the only RLS policies that match are the
// SELECT-only *_public_read policies (rows of is_public workstreams).
// A private slug and a nonexistent slug are both a plain 404; nothing here
// distinguishes "exists but private" from "doesn't exist".

// Projections: everything a public reader may see. userId is deliberately
// absent from all three.
const publicWorkstream = (w) => ({
  id: w.id, label: w.label, color: w.color, icon: w.icon, slug: w.slug,
});
const publicTask = (t) => ({
  id: t.id, title: t.title, workstream: t.workstream, column: t.column,
  priority: t.priority, notes: t.notes, agentDispatchable: t.agentDispatchable,
  remoteRunnable: t.remoteRunnable, createdVia: t.createdVia,
  createdAt: t.createdAt, updatedAt: t.updatedAt,
});
const publicSpec = (s) => ({
  id: s.id, title: s.title, workstreamId: s.workstreamId, taskId: s.taskId,
  content: s.content, version: s.version, createdVia: s.createdVia,
  createdAt: s.createdAt, updatedAt: s.updatedAt,
});

export async function handleGet({ db, ref }) {
  if (!ref || typeof ref !== 'string') {
    return { status: 400, body: { error: 'workstream required', message: 'Workstream slug or id is required.' } };
  }

  return withPublicContext(db, async (tx) => {
    // Slugs are unique per user, not globally — two users can both publish a
    // "mold" workstream. An id (cuid) is always unambiguous.
    const matches = await tx.select().from(workstreams)
      .where(or(eq(workstreams.id, ref), eq(workstreams.slug, ref)));
    if (matches.length === 0) {
      return { status: 404, body: { error: 'not found', message: 'No public workstream with that slug.' } };
    }
    if (matches.length > 1) {
      return {
        status: 409,
        body: {
          error: 'ambiguous slug',
          message: 'Multiple public workstreams share this slug. Fetch by id instead.',
          ids: matches.map((w) => w.id),
        },
      };
    }
    const ws = matches[0];

    const taskRows = await tx.select().from(tasks)
      .where(eq(tasks.workstream, ws.id)).orderBy(desc(tasks.createdAt));

    // Specs attached to the workstream itself plus specs attached to its tasks.
    const taskIds = taskRows.map((t) => t.id);
    const specConds = [eq(specs.workstreamId, ws.id)];
    if (taskIds.length) specConds.push(inArray(specs.taskId, taskIds));
    const specRows = await tx.select().from(specs)
      .where(or(...specConds)).orderBy(desc(specs.updatedAt));

    return {
      status: 200,
      body: {
        workstream: publicWorkstream(ws),
        tasks: taskRows.map(publicTask),
        specs: specRows.map(publicSpec),
      },
    };
  });
}

export const config = { runtime: 'nodejs' };

export default withErrors(async function handle(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');

  const db = getDb();
  const rl = await checkRateLimit(db, {
    bucket: ipBucket('public-ledger', req),
    limit: 60,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter ?? 60));
    return res.status(429).json({ error: 'rate_limited', message: 'Try again later.' });
  }

  const out = await handleGet({ db, ref: req.query.workstream });
  if (out.status === 200) {
    // Ledger content changes slowly; let the CDN absorb repeat readers.
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
  }
  return res.status(out.status).json(out.body);
});
