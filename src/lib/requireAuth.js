import { getIronSession } from 'iron-session';
import { sessionOptions } from './session.js';

export async function getSession(req, res) {
  return getIronSession(req, res, sessionOptions());
}

export async function requireAuth(req, res) {
  const session = await getSession(req, res);
  if (!session.authed) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  return session;
}
