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

export default function TaskCard({ task, agents, workstreams, setDragState, onEdit, onDispatch }) {
  const { theme } = useTheme();
  const ws = workstreams?.[task.workstream] ?? { color: theme.textDim, label: task.workstream, icon: '•' };
  const agentAssigned = agents.find(a => a.taskId === task.id);
  const priorityMark = { high: "●", med: "◐", low: "○" };

  return (
    <div
      className="task-card"
      draggable
      onDragStart={() => setDragState({ taskId: task.id, overCol: null })}
      onDragEnd={() => setDragState({ taskId: null, overCol: null })}
      onClick={onEdit}
      style={{
        background: theme.cardBg,
        border: theme.cardBorder,
        padding: "5px 7px",
        marginBottom: 4,
        cursor: "grab",
        borderLeft: `3px solid ${ws.color}`,
        color: theme.text,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
        <span style={{ fontSize: 12, lineHeight: 1.3, flex: 1 }}>{task.title}</span>
        <span style={{ fontSize: 10, flexShrink: 0 }} title={`Priority: ${task.priority}`}>
          {priorityMark[task.priority]}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
        <span style={{ fontSize: 10, color: ws.color, fontWeight: "bold" }}>
          {ws.icon} {ws.label}
        </span>
        {task.agentDispatchable && <span title="Agent-dispatchable" style={{ fontSize: 11 }}>⚡</span>}
        {agentAssigned && (
          <span style={{ fontSize: 10, color: theme.highlight }}>▸ {agentAssigned.name}</span>
        )}
      </div>
      {task.agentDispatchable && task.column === "backlog" && !agentAssigned && (
        <button
          className="mac-btn"
          onClick={(e) => { e.stopPropagation(); onDispatch(); }}
          style={{ marginTop: 4, fontSize: 10, padding: "1px 8px", width: "100%" }}
        >
          ▶ Dispatch
        </button>
      )}
    </div>
  );
}
