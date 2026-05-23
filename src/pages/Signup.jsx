// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../themes';
import { api } from '../lib/api';

export default function Signup() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.signup({ email, password, inviteCode });
      nav('/app');
    } catch (err) {
      setError(err?.message || 'Sign up failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...theme.desktop, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          background: theme.chrome,
          border: theme.windowBorder,
          width: 360,
          boxShadow: theme.windowShadow || '4px 4px 0 rgba(0,0,0,0.3)',
          color: theme.text,
          fontFamily: theme.FONT,
          borderRadius: theme.window.borderRadius || 0,
          overflow: 'hidden',
        }}
      >
        <div style={{
          height: theme.titleBar.height || 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: theme.id === 'classic' ? 'center' : 'flex-start',
          paddingLeft: theme.id === 'classic' ? 0 : 12,
          borderBottom: theme.titleBar.borderBottom || `1px solid ${theme.border}`,
          fontWeight: 'bold',
          fontSize: theme.titleBar.fontSize || 12,
          background: theme.titleBarBg,
          backgroundImage: theme.titleBarBgImage,
          color: theme.titleTextColor,
          textTransform: theme.titleBar.textTransform || 'none',
          letterSpacing: theme.titleBar.letterSpacing || 'normal',
        }}>
          <span style={{
            background: theme.titleTextBg,
            padding: theme.id === 'classic' ? '0 10px' : '0',
            color: theme.titleTextColor,
          }}>
            {theme.id === 'terminal' ? '── Create your account ──' : 'Create your account'}
          </span>
        </div>
        <form onSubmit={submit} style={{ padding: 20, background: theme.windowBg }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 'bold', color: theme.textDim }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            autoComplete="email"
            style={theme.input}
          />
          <label style={{ display: 'block', margin: '12px 0 6px', fontSize: 11, fontWeight: 'bold', color: theme.textDim }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            style={theme.input}
          />
          <div style={{ marginTop: 4, fontSize: 10, color: theme.textDim }}>
            At least 8 characters.
          </div>
          <label style={{ display: 'block', margin: '12px 0 6px', fontSize: 11, fontWeight: 'bold', color: theme.textDim }}>
            Invite code
          </label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="cd_inv_..."
            style={theme.input}
          />
          {error && (
            <div style={{ color: '#990000', marginTop: 8, fontSize: 11 }}>{error}</div>
          )}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link to="/login" style={{ ...theme.link, fontSize: 11 }}>
              Already have an account? Sign in
            </Link>
            <button type="submit" disabled={busy} className="mac-btn mac-btn-primary">
              {busy ? 'Creating...' : 'Sign up'}
            </button>
          </div>
          <div style={{ marginTop: 12, textAlign: 'center', fontSize: 10, color: theme.textDim }}>
            <a href="https://github.com/gabelev/chaos_dimension" target="_blank" rel="noreferrer noopener" style={theme.link}>
              View source (AGPL-3.0)
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
