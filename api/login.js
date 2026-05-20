import { verifyPassword } from '../src/lib/passwords.js';
import { getSession } from '../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../src/lib/apiHandler.js';

export async function handleLogin(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  const { password } = req.body ?? {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'password required', message: 'Password is required.' });
  }
  const ok = await verifyPassword(password, process.env.CHAOS_PASSWORD_HASH);
  if (!ok) {
    return res.status(401).json({ error: 'invalid password', message: 'Invalid password.' });
  }
  const session = await getSession(req, res);
  session.authed = true;
  session.iat = Date.now();
  await session.save();
  return res.status(200).json({ ok: true });
}

export default withErrors(handleLogin);
