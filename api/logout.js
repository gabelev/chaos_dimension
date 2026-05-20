import { getSession } from '../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../src/lib/apiHandler.js';

export default withErrors(async function handleLogout(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  const session = await getSession(req, res);
  session.destroy();
  return res.status(200).json({ ok: true });
});
