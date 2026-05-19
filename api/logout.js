import { getSession } from '../src/lib/requireAuth.js';

export default async function handleLogout(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const session = await getSession(req, res);
  session.destroy();
  return res.status(200).json({ ok: true });
}
