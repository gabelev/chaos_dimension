import { getSession } from '../src/lib/requireAuth.js';

export default async function handleMe(req, res) {
  const session = await getSession(req, res);
  if (!session.authed) {
    return res.status(401).json({ authed: false });
  }
  return res.status(200).json({ authed: true });
}
