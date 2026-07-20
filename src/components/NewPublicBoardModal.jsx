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
import { useTheme } from '../themes';
import ModalShell from './ModalShell';

// One-field creator for a public board: type a name, get a workstream that's
// already flagged public plus its shareable URL. onCreate(name) creates the
// workstream (isPublic: true) and resolves to the created row (with its slug).
export default function NewPublicBoardModal({ onCreate, onClose }) {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [board, setBoard] = useState(null); // created row once done
  const [copied, setCopied] = useState(false);

  const url = board
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/${board.slug}`
    : '';

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const created = await onCreate(name.trim());
      setBoard(created);
    } catch (e2) {
      setErr(e2?.message || 'Could not create the board.');
    } finally {
      setBusy(false);
    }
  }

  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 'bold', color: theme.textDim, marginBottom: 4 };

  return (
    <ModalShell title="New Public Board" onClose={onClose} width={420} zIndex={400}>
      {!board ? (
        <form onSubmit={submit} style={{ padding: 20, background: theme.windowBg, color: theme.text }}>
          <label style={labelStyle} htmlFor="public-board-name">Board name</label>
          <input
            id="public-board-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mold, Roadmap, Field Notes"
            autoFocus
            style={{ ...theme.input, width: '100%' }}
          />
          <p style={{ fontSize: 11, color: theme.textDim, margin: '8px 0 0', lineHeight: 1.5 }}>
            Creates a workstream that anyone can read — no login — at a public URL.
            You can add tasks and specs to it like any other board, and toggle it
            private again anytime from Manage Workstreams.
          </p>
          {err && <div style={{ color: '#990000', marginTop: 8, fontSize: 11 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 16 }}>
            <button type="button" className="mac-btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="mac-btn mac-btn-primary" disabled={busy || !name.trim()}>
              {busy ? 'Creating…' : 'Create public board'}
            </button>
          </div>
        </form>
      ) : (
        <div style={{ padding: 20, background: theme.windowBg, color: theme.text }}>
          <div style={{ fontSize: 12, marginBottom: 10 }}>
            <strong>{board.icon} {board.label}</strong> is live and public. Share this link:
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: theme.id === 'terminal' ? '#000' : '#f5f5f0',
            color: theme.id === 'terminal' ? '#0f0' : '#000',
            border: `1px solid ${theme.border}`, padding: '6px 8px',
            fontFamily: 'Courier New, monospace', fontSize: 12, wordBreak: 'break-all',
          }}>
            <code style={{ flex: 1 }}>{url}</code>
            <button
              type="button"
              className="mac-btn"
              style={{ fontSize: 11, padding: '2px 8px', whiteSpace: 'nowrap' }}
              onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <a href={url} target="_blank" rel="noreferrer" style={{ ...theme.link, fontSize: 12 }}>
              Open the board ↗
            </a>
            <button type="button" className="mac-btn mac-btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
