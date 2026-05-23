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
import { COLUMNS, COL_LABELS } from '../data/workstreams';
import { useTheme } from '../themes';
import ModalShell from './ModalShell';

export default function TaskModal({ task, workstreams = {}, onSave, onClose, onDelete }) {
  const { theme } = useTheme();
  const wsKeys = Object.keys(workstreams);
  const defaultWs = task?.workstream || wsKeys[0] || 'general';
  const [title, setTitle] = useState(task?.title || "");
  const [workstream, setWorkstream] = useState(defaultWs);
  const [priority, setPriority] = useState(task?.priority || "med");
  const [notes, setNotes] = useState(task?.notes || "");
  const [agentDispatchable, setAgentDispatchable] = useState(task?.agentDispatchable ?? true);
  const [column, setColumn] = useState(task?.column || "backlog");

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title, workstream, priority, notes, agentDispatchable, column });
  };

  const labelStyle = {
    display: "block", fontSize: 11, fontWeight: "bold",
    color: theme.textDim, marginBottom: 3, marginTop: 10,
  };

  return (
    <ModalShell title={task ? "Edit Task" : "New Task"} onClose={onClose}>
      <div style={{ padding: 16, background: theme.windowBg, color: theme.text }}>
        <label style={labelStyle}>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} style={theme.input} autoFocus />

        <label style={labelStyle}>Workstream</label>
        <select value={workstream} onChange={e => setWorkstream(e.target.value)} style={theme.input}>
          {Object.entries(workstreams).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)} style={theme.input}>
              <option value="high">● High</option>
              <option value="med">◐ Medium</option>
              <option value="low">○ Low</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Status</label>
            <select value={column} onChange={e => setColumn(e.target.value)} style={theme.input}>
              {COLUMNS.map(c => <option key={c} value={c}>{COL_LABELS[c]}</option>)}
            </select>
          </div>
        </div>

        <label style={labelStyle}>Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          style={{ ...theme.input, height: 60, resize: "vertical" }}
        />

        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={agentDispatchable}
            onChange={e => setAgentDispatchable(e.target.checked)}
          />
          ⚡ Agent-dispatchable
        </label>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <div>
            {onDelete && (
              <button className="mac-btn" onClick={onDelete} style={{ color: "#990000" }}>
                Delete
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="mac-btn" onClick={onClose}>Cancel</button>
            <button className="mac-btn mac-btn-primary" onClick={handleSave}>
              {task ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
