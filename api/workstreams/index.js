import { getDb } from '../../src/db/client.js';
import { workstreams } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';
import { eq } from 'drizzle-orm';

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

async function nextAvailableId(db, baseId) {
  const exists = async (id) => (await db.select().from(workstreams).where(eq(workstreams.id, id))).length > 0;
  if (!(await exists(baseId))) return baseId;
  for (let n = 2; n <= 100; n += 1) {
    const candidate = `${baseId}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
  return null;
}

export default withErrors(async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const db = getDb();

  if (req.method === 'GET') {
    const rows = await db.select().from(workstreams);
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const color = typeof body.color === 'string' ? body.color.trim() : '';
    const icon = typeof body.icon === 'string' ? body.icon.trim() : '';
    const providedId = typeof body.id === 'string' ? body.id : '';

    if (!label) return res.status(400).json({ error: 'label required', message: 'Workstream name is required.' });
    if (!color) return res.status(400).json({ error: 'color required', message: 'Color is required.' });
    if (!icon) return res.status(400).json({ error: 'icon required', message: 'Icon is required.' });

    const baseId = slugify(providedId || label);
    if (!baseId) {
      return res.status(400).json({
        error: 'invalid id',
        message: 'Could not derive a URL-safe id from the label. Try adding letters or numbers.',
      });
    }

    const id = await nextAvailableId(db, baseId);
    if (!id) {
      return res.status(409).json({ error: 'id collision', message: 'Too many workstreams with this name.' });
    }

    const [row] = await db.insert(workstreams).values({ id, label, color, icon }).returning();
    return res.status(201).json(row);
  }

  return methodNotAllowed(res, 'GET, POST');
});
