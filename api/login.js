import { verifyPassword } from '../src/lib/passwords.js';
import { getSession } from '../src/lib/requireAuth.js';

export async function handleLogin(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const { password } = req.body ?? {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'password required' });
  }
  const ok = await verifyPassword(password, process.env.CHAOS_PASSWORD_HASH);
  if (!ok) {
    return res.status(401).json({ error: 'invalid password' });
  }
  const session = await getSession(req, res);
  session.authed = true;
  session.iat = Date.now();
  await session.save();
  return res.status(200).json({ ok: true });
}

export default handleLogin;
