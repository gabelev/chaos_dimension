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

export default function AgentCard({ agent, task, onComplete }) {
  const { theme: MAC } = useTheme();
  return (
    <div style={{
      borderBottom: `1px solid ${MAC.chromeDark}`,
      padding: 8,
      flex: agent.status === "running" ? 2 : 1,
      color: MAC.text,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", display: "inline-block",
            background: agent.status === "running" ? "#00AA00" : MAC.chromeDark,
            border: `1px solid ${MAC.border}`,
          }} />
          <span style={{ fontWeight: "bold", fontSize: 11 }}>{agent.name}</span>
        </div>
        <span style={{ fontSize: 10, color: MAC.textDim, textTransform: "uppercase" }}>
          {agent.status}
        </span>
      </div>

      {agent.status === "running" && task && (
        <>
          <div style={{ fontSize: 11, marginBottom: 4, color: MAC.text }}>
            → {task.title}
          </div>
          <div style={{
            background: "#1a1a2e", color: "#00FF00", fontFamily: "'Courier New', monospace",
            fontSize: 10, padding: "4px 6px", borderRadius: 2, marginBottom: 4,
            border: `2px inset ${MAC.chromeDark}`, maxHeight: 60, overflow: "auto",
          }}>
            {agent.log.map((line, j) => <div key={j}>{line}</div>)}
            <span style={{ animation: "blink 1s step-end infinite" }}>▌</span>
          </div>
          <button className="mac-btn" onClick={onComplete} style={{ fontSize: 10, padding: "2px 10px" }}>
            ✓ Mark Complete
          </button>
        </>
      )}

      {agent.status === "idle" && (
        <div style={{ fontSize: 10, color: MAC.textDim, fontStyle: "italic" }}>
          Awaiting dispatch...
        </div>
      )}
    </div>
  );
}
