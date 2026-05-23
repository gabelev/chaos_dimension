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

const PALETTE = [
  '#CC0066', '#FF6600', '#FFAA00', '#66AA00',
  '#0099CC', '#6633CC', '#999999', '#000000',
];

function WorkstreamRow({ id, ws, onUpdate, onDelete }) {
  const { theme } = useTheme();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(ws.label);
  const [color, setColor] = useState(ws.color);
  const [icon, setIcon] = useState(ws.icon);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await onUpdate(id, { label, color, icon });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await onDelete(id);
    } catch {
      // alert shown by App; restore busy
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div style={{ padding: 8, borderBottom: `1px solid ${theme.chromeDark}`, background: theme.chromeLight }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} style={{ ...theme.input, width: 40, textAlign: 'center' }} />
          <input value={label} onChange={(e) => setLabel(e.target.value)} style={{ ...theme.input, flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{
                width: 20, height: 20, background: c, cursor: 'pointer',
                border: color === c ? `2px solid ${theme.text}` : `1px solid ${theme.chromeDark}`,
              }}
              aria-label={c}
            />
          ))}
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ ...theme.input, width: 80, marginLeft: 8 }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button type="button" className="mac-btn" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
          <button type="button" className="mac-btn mac-btn-primary" onClick={save} disabled={busy || !label.trim()}>
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: `1px solid ${theme.chromeDark}` }}>
      <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{ws.icon}</span>
      <span style={{ flex: 1, fontSize: 12 }}>{ws.label}</span>
      <span style={{ width: 16, height: 16, background: ws.color, border: `1px solid ${theme.chromeDark}` }} title={ws.color} />
      <span style={{ fontSize: 10, color: theme.textDim, fontFamily: 'Courier New, monospace' }}>{id}</span>
      <button type="button" className="mac-btn" onClick={() => setEditing(true)} disabled={busy} style={{ fontSize: 10, padding: '1px 8px' }}>
        Edit
      </button>
      <button type="button" className="mac-btn" onClick={remove} disabled={busy} style={{ fontSize: 10, padding: '1px 8px', color: '#990000' }}>
        Delete
      </button>
    </div>
  );
}

function NewWorkstreamForm({ onCreate, defaultColor }) {
  const { theme } = useTheme();
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('•');
  const [color, setColor] = useState(defaultColor);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    try {
      await onCreate({ label: label.trim(), icon: icon.trim() || '•', color });
      setLabel('');
      setIcon('•');
    } catch (err) {
      alert(err.message || 'Could not create workstream');
    } finally {
      setBusy(false);
    }
  }

  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 'bold',
    color: theme.textDim, marginBottom: 3,
  };

  return (
    <form onSubmit={submit} style={{ padding: 12, background: theme.chromeLight, borderTop: `1px solid ${theme.chromeDark}` }}>
      <label style={labelStyle}>Add a new workstream</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="Icon"
          style={{ ...theme.input, width: 40, textAlign: 'center' }}
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Workstream name"
          style={{ ...theme.input, flex: 1 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            style={{
              width: 20, height: 20, background: c, cursor: 'pointer',
              border: color === c ? `2px solid ${theme.text}` : `1px solid ${theme.chromeDark}`,
            }}
            aria-label={c}
          />
        ))}
        <input
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{ ...theme.input, width: 80, marginLeft: 8 }}
        />
      </div>
      <div style={{ textAlign: 'right' }}>
        <button type="submit" className="mac-btn mac-btn-primary" disabled={busy || !label.trim()}>
          {busy ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default function WorkstreamModal({ workstreams, onCreate, onUpdate, onDelete, onClose }) {
  const { theme } = useTheme();
  const entries = Object.entries(workstreams);
  return (
    <ModalShell title="Workstreams" onClose={onClose} width={520} zIndex={400}>
      <div style={{ background: theme.windowBg, minHeight: 100 }}>
        {entries.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: theme.textDim, fontSize: 11 }}>
            No workstreams yet. Add one below.
          </div>
        ) : (
          entries.map(([id, ws]) => (
            <WorkstreamRow key={id} id={id} ws={ws} onUpdate={onUpdate} onDelete={onDelete} />
          ))
        )}
      </div>
      <NewWorkstreamForm onCreate={onCreate} defaultColor={PALETTE[0]} />
      <div style={{ padding: 8, textAlign: 'right', background: theme.chrome, borderTop: `1px solid ${theme.chromeDark}` }}>
        <button type="button" className="mac-btn" onClick={onClose}>Done</button>
      </div>
    </ModalShell>
  );
}
