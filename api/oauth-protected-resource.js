import { protectedResourceMetadata, originFromRequest } from '../src/lib/oauthMetadata.js';

export const config = { runtime: 'nodejs' };

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json(protectedResourceMetadata(originFromRequest(req)));
}
