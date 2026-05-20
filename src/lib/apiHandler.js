export function withErrors(handler) {
  return async function wrapped(req, res) {
    try {
      return await handler(req, res);
    } catch (err) {
      console.error(`${req.method} ${req.url ?? ''}`, err);
      return res.status(500).json({
        error: 'server error',
        message: err?.message || 'Unknown server error.',
      });
    }
  };
}

export function methodNotAllowed(res, allow) {
  res.setHeader('Allow', allow);
  return res.status(405).json({ error: 'method not allowed' });
}
