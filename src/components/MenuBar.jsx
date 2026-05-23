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

export function MenuBar({ children, clock }) {
  const { theme } = useTheme();
  return (
    <div style={{
      height: 22, background: theme.chrome, borderBottom: `1px solid ${theme.border}`,
      display: "flex", alignItems: "center", padding: "0 8px", flexShrink: 0, zIndex: 100,
      color: theme.text,
      backgroundImage: theme.id === 'classic'
        ? `linear-gradient(to bottom, ${theme.chromeLight} 0%, ${theme.chrome} 100%)`
        : 'none',
      fontFamily: theme.FONT,
    }}>
      {children}
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11, paddingRight: 4 }}>
        {clock.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </span>
    </div>
  );
}

export function MenuBarItem({ label, active, onClick, children }) {
  const { theme } = useTheme();
  return (
    <div style={{ position: "relative" }}>
      <div onClick={onClick} style={{
        padding: "2px 10px", fontWeight: "bold", fontSize: 12, cursor: "default",
        background: active ? theme.highlight : "transparent",
        color: active ? theme.highlightText : theme.text,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export function MenuDropdown({ items }) {
  const { theme } = useTheme();
  return (
    <div style={{
      position: "absolute", top: "100%", left: 0, minWidth: 220,
      background: theme.chrome, border: theme.windowBorder,
      boxShadow: theme.windowShadow || "3px 3px 0 rgba(0,0,0,0.25)", zIndex: 200, padding: "2px 0",
      color: theme.text,
      fontFamily: theme.FONT,
    }}>
      {items.map((item, i) => item.divider ? (
        <div key={i} style={{ height: 1, background: theme.chromeDark, margin: "3px 0" }} />
      ) : (
        <div key={i} onClick={item.disabled ? undefined : item.action} style={{
          padding: "3px 20px", fontSize: 12, cursor: item.disabled ? "default" : "pointer",
          color: item.disabled ? theme.textDim : theme.text, display: "flex", justifyContent: "space-between",
        }}
          onMouseEnter={e => { if (!item.disabled) { e.currentTarget.style.background = theme.highlight; e.currentTarget.style.color = theme.highlightText; } }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = item.disabled ? theme.textDim : theme.text; }}
        >
          <span>{item.checked ? "✓ " : "    "}{item.label}</span>
          {item.shortcut && <span style={{ color: "inherit", fontSize: 11 }}>{item.shortcut}</span>}
        </div>
      ))}
    </div>
  );
}

export function FilterPill({ label, title, active, onClick }) {
  const { theme } = useTheme();
  return (
    <button onClick={onClick} title={title} style={{
      padding: "1px 6px",
      border: `1px solid ${active ? theme.border : theme.chromeDark}`,
      background: active ? theme.highlight : theme.chromeLight,
      color: active ? theme.highlightText : theme.text,
      fontSize: 11, cursor: "pointer", borderRadius: 3, fontFamily: "inherit",
    }}>{label}</button>
  );
}
