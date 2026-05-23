// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../themes';

export default function OauthConsent() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [state, setState] = useState({ kind: 'loading' });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const req = params.get('req');
    if (!req) {
      setState({ kind: 'error', message: 'Missing request token.' });
      return;
    }
    fetch(`/api/oauth/authorize/pending?req=${encodeURIComponent(req)}`)
      .then(async (r) => {
        if (r.status === 401) {
          navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return null;
        }
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error || 'bad request');
        return body;
      })
      .then((body) => { if (body) setState({ kind: 'ready', ...body }); })
      .catch((e) => setState({ kind: 'error', message: e.message }));
  }, [navigate]);

  async function decide(decision) {
    const r = await fetch('/api/oauth/authorize/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf: state.csrf, decision }),
    });
    const body = await r.json();
    if (!r.ok) {
      setState({ kind: 'error', message: body?.error || 'failed' });
      return;
    }
    window.location.assign(body.redirect);
  }

  const container = { ...theme.desktop, padding: 24, overflow: 'auto', minHeight: '100vh' };
  const card = {
    background: theme.chrome,
    border: theme.windowBorder,
    maxWidth: 520,
    margin: '40px auto',
    boxShadow: theme.windowShadow || '4px 4px 0 rgba(0,0,0,0.3)',
    color: theme.text,
    fontFamily: theme.FONT,
    borderRadius: theme.window?.borderRadius || 0,
    overflow: 'hidden',
  };
  const titleBar = {
    height: theme.titleBar?.height || 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: theme.id === 'classic' ? 'center' : 'flex-start',
    paddingLeft: theme.id === 'classic' ? 0 : 12,
    borderBottom: theme.titleBar?.borderBottom || `1px solid ${theme.border}`,
    fontWeight: 'bold',
    fontSize: theme.titleBar?.fontSize || 12,
    background: theme.titleBarBg,
    backgroundImage: theme.titleBarBgImage,
    color: theme.titleTextColor,
  };
  const body = { padding: 20, background: theme.windowBg, lineHeight: 1.6 };

  if (state.kind === 'loading') {
    return <div style={container}><div style={card}><div style={titleBar}><span style={{ padding: '0 10px' }}>Connect to Chaos Dimension</span></div><div style={body}>Loading…</div></div></div>;
  }
  if (state.kind === 'error') {
    return <div style={container}><div style={card}><div style={titleBar}><span style={{ padding: '0 10px' }}>Connect to Chaos Dimension</span></div><div style={body}>Error: {state.message}</div></div></div>;
  }

  return (
    <div style={container}>
      <div style={card}>
        <div style={titleBar}>
          <span style={{ padding: '0 10px' }}>
            {theme.id === 'terminal' ? '── Connect to Chaos Dimension ──' : 'Connect to Chaos Dimension'}
          </span>
        </div>
        <div style={body}>
          <p style={{ marginBottom: 12 }}>
            <strong>{state.client_name}</strong> wants to connect to your Chaos Dimension instance.
          </p>
          <p style={{ marginBottom: 12 }}>
            It will be able to read and write your tasks, claim work, and report agent progress.
          </p>
          <p style={{ fontSize: 11, color: theme.textDim, marginBottom: 16 }}>
            Scope: <code>{state.scope}</code><br />
            Redirect: <code>{state.redirect_uri}</code>
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="mac-btn" onClick={() => decide('deny')} style={{ minWidth: 100 }}>Deny</button>
            <button className="mac-btn mac-btn-primary" onClick={() => decide('allow')} style={{ minWidth: 100 }}>Allow</button>
          </div>
        </div>
      </div>
    </div>
  );
}
