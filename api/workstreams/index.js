// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { getDb } from '../../src/db/client.js';
import { withUserContext } from '../../src/lib/userContext.js';
import { workstreams } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// Defaults for the quick "new public board" path, which supplies only a name.
// Kept identical to the New Workstream form's defaults so a quick-created board
// is indistinguishable from a hand-made one (and freely editable afterward).
const DEFAULT_COLOR = '#CC0066';
const DEFAULT_ICON = '•';

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

// Find a slug not already taken by this user. Runs inside the caller's
// withUserContext transaction, so RLS scopes the lookup to one user — slugs
// are unique per user, not globally.
async function nextAvailableSlug(tx, base) {
  const taken = async (slug) => (await tx.select().from(workstreams).where(eq(workstreams.slug, slug))).length > 0;
  if (!(await taken(base))) return base;
  for (let n = 2; n <= 100; n += 1) {
    const candidate = `${base}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  return null;
}

export default withErrors(async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const rows = await withUserContext(getDb(), session.userId, async (tx) => {
      return tx.select().from(workstreams);
    });
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    // color/icon are optional — the quick "new public board" path sends only a
    // name and falls back to the shared defaults.
    const color = (typeof body.color === 'string' && body.color.trim()) || DEFAULT_COLOR;
    const icon = (typeof body.icon === 'string' && body.icon.trim()) || DEFAULT_ICON;

    if (!label) return res.status(400).json({ error: 'label required', message: 'Workstream name is required.' });
    // isPublic opts the new board onto the unauthenticated /api/public surface —
    // accept only a real boolean, never something merely truthy.
    if ('isPublic' in body && typeof body.isPublic !== 'boolean') {
      return res.status(400).json({ error: 'invalid isPublic', message: 'isPublic must be true or false.' });
    }
    const isPublic = body.isPublic === true;

    const baseSlug = slugify(label);
    if (!baseSlug) {
      return res.status(400).json({
        error: 'invalid label',
        message: 'Could not derive a URL-safe slug from the label. Try adding letters or numbers.',
      });
    }

    const result = await withUserContext(getDb(), session.userId, async (tx) => {
      const slug = await nextAvailableSlug(tx, baseSlug);
      if (!slug) return { collision: true };
      const [row] = await tx.insert(workstreams).values({
        id: createId(),
        label,
        color,
        icon,
        slug,
        isPublic,
        userId: session.userId,
      }).returning();
      return { row };
    });
    if (result.collision) {
      return res.status(409).json({ error: 'slug collision', message: 'Too many workstreams with this name.' });
    }
    return res.status(201).json(result.row);
  }

  return methodNotAllowed(res, 'GET, POST');
});
