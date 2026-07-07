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
import { useParams, Link } from 'react-router-dom';
import { useTheme } from '../themes';
import MacWindow from '../components/MacWindow';
import { COLUMNS, COL_LABELS } from '../data/workstreams';

// Read-only public view of a workstream flagged is_public — the human-facing
// twin of GET /api/public/:slug. Mounted at /:slug (e.g. /mold), no auth.
// Everything here renders data the API already deems public; there are no
// write paths on this page at all.

const PRIORITY_MARK = { high: '●', med: '◐', low: '○' };

function ReadOnlyCard({ task, color, taskSpecs, theme }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen((v) => !v)}
      style={{
        background: theme.cardBg,
        border: theme.cardBorder,
        padding: '5px 7px',
        marginBottom: 4,
        borderLeft: `3px solid ${color}`,
        color: theme.text,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
        <span style={{ fontSize: 12, lineHeight: 1.3, flex: 1 }}>{task.title}</span>
        <span style={{ fontSize: 10, flexShrink: 0 }} title={`Priority: ${task.priority}`}>
          {PRIORITY_MARK[task.priority]}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
        {task.agentDispatchable && <span title="Agent-dispatchable" style={{ fontSize: 11 }}>⚡</span>}
        {taskSpecs.length > 0 && <span title="Has a spec / requirements doc" style={{ fontSize: 10 }}>📄</span>}
        {!open && task.notes && (
          <span style={{ fontSize: 10, color: theme.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.notes}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 9, color: theme.textDim, flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 5, borderTop: `1px solid ${theme.chromeDark}`, paddingTop: 5 }}>
          {task.notes ? (
            <pre style={{
              margin: '0 0 5px', fontSize: 11, lineHeight: 1.5,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: 'Courier New, monospace', color: theme.text,
            }}>
              {task.notes}
            </pre>
          ) : (
            <div style={{ fontSize: 10, color: theme.textDim, marginBottom: 5 }}>No notes.</div>
          )}
          {taskSpecs.map((s) => (
            <div key={s.id} style={{ fontSize: 10, color: theme.textDim }}>
              📄 {s.title} (v{s.version} — see Specs below)
            </div>
          ))}
          <div style={{ fontSize: 9, color: theme.textDim, marginTop: 4 }}>
            created {new Date(task.createdAt).toLocaleDateString()} · updated {new Date(task.updatedAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
}

function SpecEntry({ spec, theme }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${theme.chromeDark}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', width: '100%', alignItems: 'center', gap: 8,
          padding: '6px 8px', background: 'none', border: 'none',
          cursor: 'pointer', color: theme.text, fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 10 }}>{open ? '▾' : '▸'}</span>
        <span style={{ flex: 1, fontSize: 12 }}>📄 {spec.title}</span>
        <span style={{ fontSize: 10, color: theme.textDim }}>v{spec.version}</span>
        <span style={{ fontSize: 10, color: theme.textDim }}>
          {new Date(spec.updatedAt).toLocaleDateString()}
        </span>
      </button>
      {open && (
        <pre style={{
          margin: 0, padding: '4px 8px 10px 26px',
          fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          fontFamily: 'Courier New, monospace', color: theme.text,
        }}>
          {spec.content}
        </pre>
      )}
    </div>
  );
}

function CenteredNote({ theme, title, children }) {
  return (
    <div style={{ ...theme.desktop, padding: 24, overflow: 'auto', minHeight: '100vh' }}>
      <div style={{
        background: theme.windowBg, border: theme.windowBorder,
        boxShadow: theme.windowShadow || '4px 4px 0 rgba(0,0,0,0.3)',
        maxWidth: 420, margin: '80px auto', padding: 24,
        color: theme.text, fontFamily: theme.FONT, textAlign: 'center',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 12, color: theme.textDim }}>{children}</div>
      </div>
    </div>
  );
}

export default function PublicLedger() {
  const { slug } = useParams();
  const { theme } = useTheme();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetch(`/api/public/${encodeURIComponent(slug)}`)
        .then(async (res) => {
          if (res.status === 404 || res.status === 409) return { status: 'notfound' };
          if (!res.ok) throw new Error(String(res.status));
          return { status: 'ok', data: await res.json() };
        })
        .then((next) => { if (!cancelled) setState(next); })
        // A transient refresh failure must not blank an already-rendered board.
        .catch(() => { if (!cancelled) setState((prev) => (prev.status === 'ok' ? prev : { status: 'error' })); });
    };
    load();
    const interval = setInterval(load, 60000);
    const onVisibility = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [slug]);

  useEffect(() => {
    if (state.status === 'ok') document.title = `${state.data.workstream.label} — Chaos Dimension`;
  }, [state]);

  if (state.status === 'loading') return null;
  if (state.status === 'error') {
    return <CenteredNote theme={theme} title="Temporarily unavailable">Could not load this ledger. Try again in a minute.</CenteredNote>;
  }
  if (state.status === 'notfound') {
    return (
      <CenteredNote theme={theme} title="Nothing public here">
        There is no public workstream at this address.{' '}
        <Link to="/" style={theme.link}>Chaos Dimension</Link>
      </CenteredNote>
    );
  }

  const { workstream: ws, tasks, specs } = state.data;
  const specsByTask = specs.reduce((acc, s) => {
    if (s.taskId) (acc[s.taskId] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div style={{ ...theme.desktop, padding: 16, overflow: 'auto', minHeight: '100vh', fontFamily: theme.FONT }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <MacWindow title={`${ws.icon} ${ws.label} — public ledger`} stacked minHeight={0}>
          <div style={{ padding: 10, background: theme.windowBg }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 8,
            }}>
              {COLUMNS.map((col) => {
                const colTasks = tasks.filter((t) => t.column === col);
                return (
                  <div key={col} style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 'bold', color: theme.textDim,
                      padding: '2px 4px', marginBottom: 4,
                      borderBottom: `2px solid ${ws.color}`,
                    }}>
                      {COL_LABELS[col]} ({colTasks.length})
                    </div>
                    {colTasks.map((t) => (
                      <ReadOnlyCard key={t.id} task={t} color={ws.color} taskSpecs={specsByTask[t.id] || []} theme={theme} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </MacWindow>

        {specs.length > 0 && (
          <MacWindow title={`📄 Specs (${specs.length})`} stacked minHeight={0}>
            <div style={{ background: theme.windowBg }}>
              {specs.map((s) => <SpecEntry key={s.id} spec={s} theme={theme} />)}
            </div>
          </MacWindow>
        )}

        <div style={{ textAlign: 'center', fontSize: 10, color: theme.textDim, padding: '8px 0 16px' }}>
          Read-only public ledger · powered by{' '}
          <a href="https://github.com/gabelev/chaos_dimension" target="_blank" rel="noreferrer" style={theme.link}>
            Chaos Dimension
          </a>
        </div>
      </div>
    </div>
  );
}
