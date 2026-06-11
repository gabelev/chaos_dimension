// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../themes';
import { api } from '../lib/api';

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10);
}

function Section({ theme, title, children }) {
  return (
    <div style={{
      background: theme.chrome, border: theme.windowBorder, marginBottom: 14,
      borderRadius: theme.window?.borderRadius || 0, overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 12px', background: theme.titleBarBg, backgroundImage: theme.titleBarBgImage,
        color: theme.titleTextColor, fontWeight: 'bold', fontSize: theme.titleBar?.fontSize || 12,
        borderBottom: `1px solid ${theme.border}`,
      }}>
        {title}
      </div>
      <div style={{ padding: '12px 14px', background: theme.windowBg, color: theme.text }}>
        {children}
      </div>
    </div>
  );
}

function CodeBox({ theme, value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: theme.id === 'terminal' ? '#000' : '#f5f5f0',
      color: theme.id === 'terminal' ? '#0f0' : '#000',
      border: `1px solid ${theme.border}`, padding: '4px 6px', margin: '4px 0',
      fontFamily: 'Courier New, monospace', fontSize: 11, wordBreak: 'break-all',
    }}>
      <code style={{ flex: 1 }}>{value}</code>
      <button type="button" className="mac-btn" style={{ fontSize: 10, padding: '1px 6px', whiteSpace: 'nowrap' }}
        onClick={() => navigator.clipboard?.writeText(value)}>
        Copy
      </button>
    </div>
  );
}

const cell = { padding: '4px 6px', fontSize: 12, textAlign: 'left', verticalAlign: 'top' };

function InvitesSection({ theme }) {
  const [invites, setInvites] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api.listInvites().then(setInvites).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function mint() {
    setBusy(true); setErr('');
    try {
      const created = await api.mintInvite(note.trim());
      setNote('');
      setInvites((prev) => [{ ...created, status: 'open', createdAt: new Date().toISOString() }, ...prev]);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function revoke(id) {
    if (!window.confirm('Revoke this unused invite?')) return;
    try {
      await api.revokeInvite(id);
      setInvites((prev) => prev.filter((i) => i.id !== id));
    } catch (e) { setErr(e.message); }
  }

  return (
    <Section theme={theme} title="Invites">
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="note (e.g. for Jane)" style={{ ...theme.input, flex: 1 }} />
        <button type="button" className="mac-btn mac-btn-primary" onClick={mint} disabled={busy}>
          {busy ? 'Minting…' : 'Mint invite'}
        </button>
      </div>
      {err && <div style={{ color: '#990000', fontSize: 11, marginBottom: 8 }}>{err}</div>}
      {invites.length === 0 ? (
        <div style={{ fontSize: 12, color: theme.textDim }}>No invites yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: theme.textDim, fontSize: 10, textTransform: 'uppercase' }}>
              <th style={cell}>Code</th><th style={cell}>Note</th><th style={cell}>Status</th><th style={cell}>Created</th><th style={cell} />
            </tr>
          </thead>
          <tbody>
            {invites.map((i) => (
              <tr key={i.id} style={{ borderTop: `1px solid ${theme.chromeDark || theme.border}` }}>
                <td style={{ ...cell, minWidth: 200 }}><CodeBox theme={theme} value={i.code} /></td>
                <td style={cell}>{i.note || '—'}</td>
                <td style={cell}>{i.status === 'claimed' ? `claimed${i.claimedByEmail ? ` · ${i.claimedByEmail}` : ''}` : 'open'}</td>
                <td style={cell}>{fmtDate(i.createdAt)}</td>
                <td style={cell}>
                  {i.status !== 'claimed' && (
                    <button type="button" className="mac-btn" style={{ fontSize: 10, padding: '1px 8px', color: '#990000' }} onClick={() => revoke(i.id)}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function UsersSection({ theme }) {
  const [users, setUsers] = useState([]);
  const [reset, setReset] = useState(null); // { id, password }
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api.listUsers().then(setUsers).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function resetPassword(u) {
    if (!window.confirm(`Reset the password for ${u.email}? A new temporary password will be shown once.`)) return;
    setErr('');
    try {
      const res = await api.resetUserPassword(u.id);
      setReset({ id: u.id, password: res.password });
    } catch (e) { setErr(e.message); }
  }

  async function remove(u) {
    if (!window.confirm(`Delete ${u.email}? This permanently removes their account and all their tasks, workstreams, and tokens.`)) return;
    setErr('');
    try {
      await api.deleteUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e) { setErr(e.message); }
  }

  return (
    <Section theme={theme} title="Users">
      {err && <div style={{ color: '#990000', fontSize: 11, marginBottom: 8 }}>{err}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: theme.textDim, fontSize: 10, textTransform: 'uppercase' }}>
            <th style={cell}>Email</th><th style={cell}>Name</th><th style={cell}>Joined</th><th style={cell} />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <Fragment key={u.id}>
              <tr style={{ borderTop: `1px solid ${theme.chromeDark || theme.border}` }}>
                <td style={cell}>{u.email}{u.isOwner && <span style={{ fontSize: 9, color: theme.textDim }}> (you)</span>}</td>
                <td style={cell}>{u.name}</td>
                <td style={cell}>{fmtDate(u.createdAt)}</td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                  {u.isOwner ? (
                    <span style={{ fontSize: 10, color: theme.textDim }}>owner</span>
                  ) : (
                    <>
                      <button type="button" className="mac-btn" style={{ fontSize: 10, padding: '1px 8px' }} onClick={() => resetPassword(u)}>
                        Reset password
                      </button>
                      <button type="button" className="mac-btn" style={{ fontSize: 10, padding: '1px 8px', marginLeft: 4, color: '#990000' }} onClick={() => remove(u)}>
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
              {reset?.id === u.id && (
                <tr>
                  <td colSpan={4} style={{ ...cell, background: theme.chrome }}>
                    <div style={{ fontSize: 11, marginBottom: 2 }}>Temporary password (shown once — share it securely):</div>
                    <CodeBox theme={theme} value={reset.password} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function WaitlistSection({ theme }) {
  const [entries, setEntries] = useState([]);
  const [invited, setInvited] = useState(null); // { id, code }
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    api.listWaitlist().then(setEntries).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function invite(entry) {
    setErr('');
    try {
      const res = await api.inviteFromWaitlist(entry.id);
      setInvited({ id: entry.id, code: res.code });
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, invited: true } : e)));
    } catch (e) { setErr(e.message); }
  }

  async function remove(entry) {
    if (!window.confirm(`Remove ${entry.email} from the waitlist?`)) return;
    setErr('');
    try {
      await api.deleteWaitlistEntry(entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (e) { setErr(e.message); }
  }

  return (
    <Section theme={theme} title="Waitlist">
      {err && <div style={{ color: '#990000', fontSize: 11, marginBottom: 8 }}>{err}</div>}
      {entries.length === 0 ? (
        <div style={{ fontSize: 12, color: theme.textDim }}>No one on the waitlist.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: theme.textDim, fontSize: 10, textTransform: 'uppercase' }}>
              <th style={cell}>Email</th><th style={cell}>Name</th><th style={cell}>Note</th><th style={cell}>Added</th><th style={cell} />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <Fragment key={e.id}>
                <tr style={{ borderTop: `1px solid ${theme.chromeDark || theme.border}` }}>
                  <td style={cell}>{e.email}</td>
                  <td style={cell}>{e.name || '—'}</td>
                  <td style={cell}>{e.note || '—'}</td>
                  <td style={cell}>{fmtDate(e.createdAt)}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    {e.invited ? (
                      <span style={{ fontSize: 10, color: theme.textDim }}>invited</span>
                    ) : (
                      <button type="button" className="mac-btn mac-btn-primary" style={{ fontSize: 10, padding: '1px 8px' }} onClick={() => invite(e)}>
                        Invite
                      </button>
                    )}
                    <button type="button" className="mac-btn" style={{ fontSize: 10, padding: '1px 8px', marginLeft: 4, color: '#990000' }} onClick={() => remove(e)}>
                      Remove
                    </button>
                  </td>
                </tr>
                {invited?.id === e.id && (
                  <tr>
                    <td colSpan={5} style={{ ...cell, background: theme.chrome }}>
                      <div style={{ fontSize: 11, marginBottom: 2 }}>Invite code (share the link or code):</div>
                      <CodeBox theme={theme} value={invited.code} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

export default function Admin() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading | ok | denied

  useEffect(() => {
    api.me()
      .then((r) => setState(r?.isOwner ? 'ok' : 'denied'))
      .catch(() => setState('denied'));
  }, []);

  useEffect(() => {
    if (state === 'denied') navigate('/app', { replace: true });
  }, [state, navigate]);

  if (state !== 'ok') return null;

  // height:100vh (not minHeight) makes the outer div a real scroll container —
  // the global body has overflow:hidden, so a min-height box would just clip.
  return (
    <div style={{ ...theme.desktop, padding: 24, height: '100vh', overflow: 'auto' }}>
      <div style={{
        background: theme.chrome, border: theme.windowBorder, maxWidth: 820, margin: '0 auto',
        boxShadow: theme.windowShadow || '4px 4px 0 rgba(0,0,0,0.3)', color: theme.text,
        fontFamily: theme.FONT, borderRadius: theme.window?.borderRadius || 0, overflow: 'hidden',
      }}>
        <div style={{
          height: theme.titleBar?.height || 22, display: 'flex', alignItems: 'center',
          justifyContent: theme.id === 'classic' ? 'center' : 'flex-start',
          paddingLeft: theme.id === 'classic' ? 0 : 12,
          borderBottom: theme.titleBar?.borderBottom || `1px solid ${theme.border}`,
          fontWeight: 'bold', fontSize: theme.titleBar?.fontSize || 12,
          background: theme.titleBarBg, backgroundImage: theme.titleBarBgImage, color: theme.titleTextColor,
        }}>
          <span style={{ padding: theme.id === 'classic' ? '0 10px' : '0', color: theme.titleTextColor }}>
            {theme.id === 'terminal' ? '── Admin ──' : 'Admin'}
          </span>
        </div>
        <div style={{ padding: 20, background: theme.windowBg }}>
          <p style={{ marginBottom: 16, lineHeight: 1.5, fontSize: 13 }}>
            Owner-only controls. Mint and revoke invites, reset a user's password, and manage the waitlist.
          </p>
          <InvitesSection theme={theme} />
          <UsersSection theme={theme} />
          <WaitlistSection theme={theme} />
          <p style={{ marginTop: 16, fontSize: 11, color: theme.textDim }}>
            <Link to="/app" style={theme.link}>← Back to the board</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
