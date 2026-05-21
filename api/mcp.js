import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authenticateMcpRequest } from '../src/lib/mcpAuth.js';
import { TOOLS, runTool } from '../src/lib/mcpTools.js';

function buildServer(ctx) {
  const server = new Server(
    { name: 'chaos-dimension', version: '0.4.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await runTool(request.params.name, request.params.arguments ?? {}, ctx);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: err?.message || 'tool error' }],
      };
    }
  });

  return server;
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const auth = await authenticateMcpRequest(req);
  if (!auth) {
    // Per RFC 9728, point clients at the protected-resource metadata so they
    // can discover the auth server and complete the OAuth dance.
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const resourceMetadata = `${proto}://${host}/.well-known/oauth-protected-resource`;
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadata}"`);
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing bearer token.' });
  }

  const server = buildServer({ agentId: auth.agentId, agentName: auth.agentName, userId: auth.userId });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
