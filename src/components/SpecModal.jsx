// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { useState, useEffect } from 'react';
import { useTheme } from '../themes';
import ModalShell from './ModalShell';

// Editor for one spec / requirements doc. Opens over the Task/Workstream modal.
// New specs (no spec.id) collect title + content; existing specs are opened
// from a metadata-only list, so we lazy-load the full content + revision
// history via loadFull. A content change on save bumps the version and appends
// a revision (handled server-side). Content is markdown, shown as monospace —
// no markdown renderer dependency by design.
export default function SpecModal({ spec, onSave, onDelete, onClose, loadFull, loadRevision }) {
  const { theme } = useTheme();
  const isNew = !spec?.id;

  const [title, setTitle] = useState(spec?.title || '');
  const [content, setContent] = useState(spec?.content ?? '');
  const [note, setNote] = useState('');
  const [version, setVersion] = useState(spec?.version || 1);
  const [revisions, setRevisions] = useState(spec?.revisions || []);
  const [viewing, setViewing] = useState(null); // a loaded historical revision
  const [loaded, setLoaded] = useState(isNew || spec?.content != null);
  const [busy, setBusy] = useState(false);

  // Existing spec opened from a metadata-only row — fetch full body + history.
  useEffect(() => {
    let cancelled = false;
    if (!isNew && spec?.content == null && loadFull) {
      loadFull(spec.id)
        .then((full) => {
          if (cancelled || !full) return;
          setTitle(full.title ?? spec.title ?? '');
          setContent(full.content ?? '');
          setVersion(full.version ?? 1);
          setRevisions(full.revisions || []);
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    }
    return () => { cancelled = true; };
  }, [isNew, spec, loadFull]);

  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 'bold',
    color: theme.textDim, marginBottom: 3, marginTop: 10,
  };

  async function handleSave() {
    if (!title.trim() || !loaded) return;
    setBusy(true);
    try {
      await onSave({ title: title.trim(), content, note: note.trim() });
      onClose();
    } catch (err) {
      alert(err.message || 'Could not save spec');
    } finally {
      setBusy(false);
    }
  }

  async function viewRevision(v) {
    if (viewing?.version === v) { setViewing(null); return; }
    if (v === version) { setViewing({ version: v, content }); return; }
    try {
      const rev = await loadRevision(spec.id, v);
      if (rev) setViewing(rev);
    } catch {
      // ignore — revision view is best-effort
    }
  }

  return (
    <ModalShell title={isNew ? 'New Spec' : 'Edit Spec'} onClose={onClose} width={560} zIndex={500}>
      <div style={{ padding: 16, background: theme.windowBg, color: theme.text }}>
        <label style={labelStyle}>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={theme.input} autoFocus />

        <label style={labelStyle}>Content (markdown){!isNew ? ` — v${version}` : ''}</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={loaded ? 'Write or dictate the spec…' : 'Loading…'}
          disabled={!loaded}
          style={{
            ...theme.input, height: 240, resize: 'vertical',
            fontFamily: 'JetBrains Mono, Courier New, monospace', fontSize: 12,
          }}
        />

        <label style={labelStyle}>Change note (optional)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What changed in this revision"
          style={theme.input}
        />

        {!isNew && revisions.length > 1 && (
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Revisions</label>
            <div style={{ border: `1px solid ${theme.chromeDark}`, borderRadius: 2, maxHeight: 120, overflow: 'auto' }}>
              {revisions.map((r) => (
                <button
                  key={r.version}
                  type="button"
                  onClick={() => viewRevision(r.version)}
                  style={{
                    display: 'flex', gap: 8, width: '100%', textAlign: 'left', padding: '4px 8px',
                    background: viewing?.version === r.version ? theme.chromeLight : 'transparent',
                    border: 'none', borderBottom: `1px solid ${theme.chromeDark}`,
                    cursor: 'pointer', color: theme.text, fontSize: 11,
                  }}
                >
                  <span style={{ width: 32 }}>v{r.version}</span>
                  <span style={{ flex: 1, color: theme.textDim }}>{r.note || r.title}</span>
                  {r.version === version && <span style={{ fontSize: 9, color: theme.textDim }}>current</span>}
                </button>
              ))}
            </div>
            {viewing && (
              <pre style={{
                marginTop: 6, padding: 8, background: theme.chromeLight,
                border: `1px solid ${theme.chromeDark}`, fontSize: 11,
                maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap',
              }}>{viewing.content}</pre>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <div>
            {!isNew && onDelete && (
              <button type="button" className="mac-btn" onClick={onDelete} style={{ color: '#990000' }}>
                Delete
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="mac-btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="mac-btn mac-btn-primary"
              onClick={handleSave}
              disabled={busy || !title.trim() || !loaded}
            >
              {isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
