// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../themes';
import { api } from '../lib/api';

const POLL_MS = 3000;
const FRESH_LAST_USED_MS = 5 * 60 * 1000;

function isFresh(value) {
  if (!value) return false;
  const t = new Date(value).getTime();
  return Number.isFinite(t) && Date.now() - t < FRESH_LAST_USED_MS;
}

function CardShell({ theme, title, open, onToggle, status, children }) {
  return (
    <div style={{
      background: theme.chrome,
      border: theme.windowBorder,
      marginBottom: 12,
      borderRadius: theme.window?.borderRadius || 0,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', background: theme.titleBarBg, backgroundImage: theme.titleBarBgImage,
          color: theme.titleTextColor, border: 'none', cursor: 'pointer',
          fontFamily: theme.FONT, fontWeight: 'bold', fontSize: theme.titleBar?.fontSize || 12,
          borderBottom: open ? `1px solid ${theme.border}` : 'none',
        }}
      >
        <span>{open ? '▼' : '▶'} {title}</span>
        {status && (
          <span style={{
            fontSize: 11, padding: '2px 8px', border: `1px solid ${theme.border}`,
            background: status.ok ? '#0a6e1f' : theme.chrome,
            color: status.ok ? '#fff' : theme.textDim,
          }}>
            {status.label}
          </span>
        )}
      </button>
      {open && (
        <div style={{ padding: '12px 16px', background: theme.windowBg, color: theme.text }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Step({ n, theme, children }) {
  return (
    <div style={{ display: 'flex', marginBottom: 8, alignItems: 'flex-start' }}>
      <div style={{ width: 22, fontWeight: 'bold', color: theme.textDim }}>{n}.</div>
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function CodeBox({ theme, value, onCopy }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: theme.id === 'terminal' ? '#000' : '#f5f5f0',
      color: theme.id === 'terminal' ? '#0f0' : '#000',
      border: `1px solid ${theme.border}`, padding: '6px 8px', margin: '6px 0',
      fontFamily: 'Courier New, monospace', fontSize: 12, wordBreak: 'break-all',
    }}>
      <code style={{ flex: 1 }}>{value}</code>
      <button
        type="button"
        onClick={() => { navigator.clipboard?.writeText(value); onCopy?.(); }}
        className="mac-btn"
        style={{ fontSize: 11, padding: '2px 8px', whiteSpace: 'nowrap' }}
      >
        Copy
      </button>
    </div>
  );
}

function VerifyPanel({ theme, ok, hint }) {
  return (
    <div style={{
      marginTop: 12, padding: 10, border: `1px solid ${theme.border}`,
      background: ok ? '#e3f5e1' : theme.chrome, color: theme.text,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: 7, flexShrink: 0,
        background: ok ? '#0a6e1f' : '#999',
      }} />
      <div style={{ fontSize: 12 }}>
        {ok ? 'Connected.' : hint}
      </div>
    </div>
  );
}

function ClaudeCard({ theme, mcpUrl }) {
  const [open, setOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const baselineRef = useRef(null);

  useEffect(() => {
    if (!open || verified) return undefined;
    let cancelled = false;
    let timer;
    const poll = async () => {
      try {
        const list = await api.listMyOauthClients();
        if (cancelled) return;
        if (baselineRef.current === null) {
          // First poll after opening: record current state as baseline.
          baselineRef.current = new Set(list.map((c) => c.id));
        } else {
          const fresh = list.find((c) => isFresh(c.lastUsedAt) || !baselineRef.current.has(c.id));
          if (fresh) {
            setVerified(true);
            return;
          }
        }
      } catch { /* swallow — keep polling */ }
      timer = setTimeout(poll, POLL_MS);
    };
    poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [open, verified]);

  return (
    <CardShell
      theme={theme}
      title="Claude (Desktop or claude.ai web)"
      open={open}
      onToggle={() => setOpen((o) => !o)}
      status={verified ? { ok: true, label: 'Connected' } : null}
    >
      <Step n={1} theme={theme}>Open <strong>Settings → Connectors → Add custom connector</strong>.</Step>
      <Step n={2} theme={theme}>
        Paste this URL:
        <CodeBox theme={theme} value={mcpUrl} />
      </Step>
      <Step n={3} theme={theme}>
        Leave <strong>OAuth Client ID</strong> and <strong>Client Secret</strong> blank — the connector self-registers via Dynamic Client Registration.<br />
        <span style={{ color: '#990000' }}>Do not paste any token here.</span>
      </Step>
      <Step n={4} theme={theme}>Click <strong>Add</strong>. A browser tab opens here for login + a consent screen. Click <strong>Allow</strong>.</Step>
      <VerifyPanel
        theme={theme}
        ok={verified}
        hint="Waiting for Claude to complete the consent dance…"
      />
      <details style={{ marginTop: 12, fontSize: 12 }}>
        <summary style={{ cursor: 'pointer', color: theme.textDim }}>Troubleshooting</summary>
        <ul style={{ marginTop: 6, paddingLeft: 18, lineHeight: 1.5 }}>
          <li>If your domain redirects apex → <code>www</code>, use the <code>www.</code> URL (MCP clients don't follow POST redirects).</li>
          <li><code>invalid_redirect_uri</code> after Allow: remove the connector and add it again.</li>
          <li>Stuck on the consent page: make sure you're logged into this dashboard in the same browser.</li>
          <li>Tokens silently expire after a while: remove + re-add if MCP calls start failing later.</li>
        </ul>
      </details>
    </CardShell>
  );
}

function ChatGptCard({ theme, mcpUrl }) {
  const [open, setOpen] = useState(false);
  return (
    <CardShell
      theme={theme}
      title="ChatGPT"
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      <p style={{ fontSize: 12, color: theme.textDim, margin: '0 0 10px' }}>
        ChatGPT supports custom MCP connectors via the same OAuth + Dynamic Client Registration flow as Claude. The first user through this card is the smoke test — if anything goes sideways, tell us and we'll wire a hand-issued OAuth client.
      </p>
      <Step n={1} theme={theme}>In ChatGPT: <strong>Settings → Connectors → Add custom connector</strong>.</Step>
      <Step n={2} theme={theme}>
        URL:
        <CodeBox theme={theme} value={mcpUrl} />
      </Step>
      <Step n={3} theme={theme}>Leave OAuth Client ID and Client Secret blank.</Step>
      <Step n={4} theme={theme}>Save → consent in browser → done.</Step>
      <VerifyPanel theme={theme} ok={false} hint="No automated verification yet — confirm by trying a tool call from a new ChatGPT chat." />
    </CardShell>
  );
}

function ClaudeCodeCard({ theme, mcpUrl }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('macbook');
  const [token, setToken] = useState(null);
  const [tokenId, setTokenId] = useState(null);
  const [minting, setMinting] = useState(false);
  const [err, setErr] = useState(null);
  const [verified, setVerified] = useState(false);

  const command = useMemo(() => {
    const t = token || '<paste-your-token>';
    return `claude mcp add --scope user --transport http chaos-dimension ${mcpUrl} --header "Authorization: Bearer ${t}"`;
  }, [mcpUrl, token]);

  const mint = useCallback(async () => {
    setMinting(true); setErr(null);
    try {
      const out = await api.mintToken(label || 'claude-code');
      setToken(out.token);
      setTokenId(out.tokenId ?? out.id ?? null);
    } catch (e) { setErr(e?.message || 'Mint failed.'); }
    finally { setMinting(false); }
  }, [label]);

  useEffect(() => {
    if (!tokenId || verified) return undefined;
    let cancelled = false; let timer;
    const poll = async () => {
      try {
        const list = await api.listMyTokens();
        if (cancelled) return;
        const row = list.find((t) => t.id === tokenId);
        if (row?.lastUsedAt) { setVerified(true); return; }
      } catch { /* keep polling */ }
      timer = setTimeout(poll, POLL_MS);
    };
    poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [tokenId, verified]);

  return (
    <CardShell
      theme={theme}
      title="Claude Code (CLI)"
      open={open}
      onToggle={() => setOpen((o) => !o)}
      status={verified ? { ok: true, label: 'Connected' } : null}
    >
      <Step n={1} theme={theme}>
        Mint a token (shown <strong>once</strong>; if you lose it, mint a new one).
        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="label (e.g. macbook)"
            style={{ ...theme.input, flex: 1 }}
            disabled={!!token}
          />
          <button type="button" onClick={mint} disabled={minting || !!token} className="mac-btn mac-btn-primary">
            {minting ? 'Minting…' : token ? 'Minted' : 'Mint token'}
          </button>
        </div>
        {err && <div style={{ color: '#990000', marginTop: 6, fontSize: 11 }}>{err}</div>}
        {token && (
          <>
            <CodeBox theme={theme} value={token} />
            <div style={{ fontSize: 11, color: '#990000' }}>
              This is the only time you'll see it. Copy it before continuing.
            </div>
          </>
        )}
      </Step>
      <Step n={2} theme={theme}>
        Run the command (your token is pre-filled once minted):
        <CodeBox theme={theme} value={command} />
        <span style={{ fontSize: 11, color: theme.textDim }}>
          <code>--scope user</code> makes the connection available across project directories. Drop it for project-scoped.
        </span>
      </Step>
      <Step n={3} theme={theme}>
        <strong>Fully quit and restart Claude Code</strong> so it loads the new config.
      </Step>
      <Step n={4} theme={theme}>
        Inside Claude Code, run <code>/mcp</code>. You should see <code>chaos-dimension</code> connected with its tools.
      </Step>
      <VerifyPanel
        theme={theme}
        ok={verified}
        hint={token ? "Waiting for Claude Code to make its first call…" : "Mint a token to start."}
      />
      <details style={{ marginTop: 12, fontSize: 12 }}>
        <summary style={{ cursor: 'pointer', color: theme.textDim }}>Manual alternative (no `claude` CLI)</summary>
        <p style={{ marginTop: 6, lineHeight: 1.5 }}>
          Open <code>~/.claude.json</code> (a single dotfile, not <code>~/.claude/.mcp.json</code>) and add this entry under <code>mcpServers</code> — creating the key if it doesn't exist:
        </p>
        <CodeBox theme={theme} value={JSON.stringify({
          mcpServers: {
            'chaos-dimension': {
              type: 'http',
              url: mcpUrl,
              headers: { Authorization: `Bearer ${token || '<paste-your-token>'}` },
            },
          },
        }, null, 2)} />
        <p style={{ marginTop: 6, lineHeight: 1.5 }}>
          The <code>"type": "http"</code> field is mandatory — without it Claude Code can't talk to the server. For per-project config, put the same JSON in a <code>.mcp.json</code> at your project root instead.
        </p>
      </details>
      <details style={{ marginTop: 12, fontSize: 12 }}>
        <summary style={{ cursor: 'pointer', color: theme.textDim }}>Troubleshooting</summary>
        <ul style={{ marginTop: 6, paddingLeft: 18, lineHeight: 1.5 }}>
          <li>"JSON Parse error: Unrecognized token '&lt;'": your URL hit a redirect. Use the <code>www.</code> form.</li>
          <li>401 from <code>/mcp</code>: token typo or revoked — mint a new one.</li>
          <li>If you mix <code>cd_</code> agent tokens and <code>cd_oat_</code> OAuth tokens, double-check which one you copied.</li>
        </ul>
      </details>
    </CardShell>
  );
}

export default function Connect() {
  const { theme } = useTheme();
  const mcpUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/api/mcp';
    return `${window.location.origin}/api/mcp`;
  }, []);

  return (
    <div style={{ ...theme.desktop, padding: 24, overflow: 'auto', minHeight: '100vh' }}>
      <div style={{
        background: theme.chrome,
        border: theme.windowBorder,
        maxWidth: 720,
        margin: '0 auto',
        boxShadow: theme.windowShadow || '4px 4px 0 rgba(0,0,0,0.3)',
        color: theme.text,
        fontFamily: theme.FONT,
        borderRadius: theme.window?.borderRadius || 0,
        overflow: 'hidden',
      }}>
        <div style={{
          height: theme.titleBar?.height || 22,
          display: 'flex', alignItems: 'center',
          justifyContent: theme.id === 'classic' ? 'center' : 'flex-start',
          paddingLeft: theme.id === 'classic' ? 0 : 12,
          borderBottom: theme.titleBar?.borderBottom || `1px solid ${theme.border}`,
          fontWeight: 'bold', fontSize: theme.titleBar?.fontSize || 12,
          background: theme.titleBarBg, backgroundImage: theme.titleBarBgImage,
          color: theme.titleTextColor,
        }}>
          <span style={{ padding: theme.id === 'classic' ? '0 10px' : '0', color: theme.titleTextColor }}>
            {theme.id === 'terminal' ? '── Connect an AI assistant ──' : 'Connect an AI assistant'}
          </span>
        </div>
        <div style={{ padding: 20, background: theme.windowBg }}>
          <p style={{ marginBottom: 16, lineHeight: 1.5, fontSize: 13 }}>
            Each card walks you through hooking one AI client up to your Chaos Dimension account. Credentials are stamped with your <code>user_id</code> at issue time, so everything you do via the connector — list tasks, dispatch agents, report progress — is scoped to your data only.
          </p>
          <ClaudeCard theme={theme} mcpUrl={mcpUrl} />
          <ChatGptCard theme={theme} mcpUrl={mcpUrl} />
          <ClaudeCodeCard theme={theme} mcpUrl={mcpUrl} />
          <p style={{ marginTop: 16, fontSize: 11, color: theme.textDim }}>
            <Link to="/app" style={theme.link}>← Back to the board</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
