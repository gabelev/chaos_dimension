// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { useTheme } from '../themes';

// A compact list of spec / requirements docs, embedded inside the Task and
// Workstream modals. Each row opens the full SpecModal editor. `scope` on a
// spec marks whether it's attached here directly ('task') or inherited from
// the parent workstream ('workstream').
export default function SpecsSection({ specs = [], onNew, onOpen, emptyHint }) {
  const { theme } = useTheme();
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 11, fontWeight: 'bold', color: theme.textDim }}>📄 Specs</label>
        {onNew && (
          <button type="button" className="mac-btn" onClick={onNew} style={{ fontSize: 10, padding: '1px 8px' }}>
            + New spec
          </button>
        )}
      </div>
      <div style={{ marginTop: 4, border: `1px solid ${theme.chromeDark}`, borderRadius: 2 }}>
        {specs.length === 0 ? (
          <div style={{ padding: 8, fontSize: 11, color: theme.textDim }}>
            {emptyHint || 'No specs yet.'}
          </div>
        ) : specs.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onOpen(s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%',
              textAlign: 'left', padding: '5px 8px', background: 'transparent',
              border: 'none', borderBottom: `1px solid ${theme.chromeDark}`,
              cursor: 'pointer', color: theme.text, fontSize: 12,
            }}
          >
            <span style={{ flex: 1 }}>{s.title}</span>
            {s.scope === 'workstream' && (
              <span style={{ fontSize: 9, color: theme.textDim }} title="Inherited from this task's workstream">stream</span>
            )}
            <span style={{ fontSize: 9, color: theme.textDim }}>v{s.version}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
