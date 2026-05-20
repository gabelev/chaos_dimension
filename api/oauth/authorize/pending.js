import { signPayload, verifyPayload } from '../../../src/lib/oauthCrypto.js';
import { getSession } from '../../../src/lib/requireAuth.js';

export async function handlePending({ session, req, sessionSecret }) {
  if (!session?.authed) return { status: 401, body: { error: 'unauthorized' } };
  const parsed = verifyPayload(req, sessionSecret);
  if (!parsed) return { status: 400, body: { error: 'invalid_request' } };

  const csrf = signPayload({ req }, sessionSecret, 5 * 60);
  return {
    status: 200,
    body: {
      client_name: parsed.client_name,
      scope: parsed.scope,
      redirect_uri: parsed.redirect_uri,
      csrf,
    },
  };
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const session = await getSession(req, res);
  const out = await handlePending({
    session,
    req: req.query?.req,
    sessionSecret: process.env.CHAOS_SESSION_SECRET,
  });
  res.status(out.status).json(out.body);
}
