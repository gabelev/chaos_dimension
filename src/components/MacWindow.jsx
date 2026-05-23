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

export default function MacWindow({ title, children, x, y, w, h, stacked = false, minHeight }) {
  const { theme } = useTheme();
  const positioning = stacked
    ? {
        position: "relative",
        width: "100%",
        height: "auto",
        minHeight: minHeight ?? 360,
        marginBottom: 8,
      }
    : { position: "absolute", left: x, top: y, width: w, height: h };
  return (
    <div style={{
      ...positioning,
      display: "flex", flexDirection: "column",
      border: theme.windowBorder,
      boxShadow: theme.windowShadow || "2px 2px 0 rgba(0,0,0,0.3)",
      background: theme.windowBg,
      borderRadius: theme.window.borderRadius || 0,
      overflow: "hidden",
    }}>
      <div style={{
        height: theme.titleBar.height || 20,
        display: "flex",
        alignItems: "center",
        padding: "0 4px",
        background: theme.titleBarBg,
        borderBottom: theme.titleBar.borderBottom || `1px solid ${theme.border}`,
        flexShrink: 0,
        backgroundImage: theme.titleBarBgImage,
        color: theme.titleTextColor,
        fontWeight: theme.titleBar.fontWeight || 'bold',
        fontSize: theme.titleBar.fontSize || 11,
        textTransform: theme.titleBar.textTransform || 'none',
        letterSpacing: theme.titleBar.letterSpacing || 'normal',
      }}>
        {theme.id === 'classic' && (
          <div style={{
            width: 12, height: 12, border: `1px solid ${theme.border}`, background: theme.chrome,
            marginRight: 6, flexShrink: 0,
          }} />
        )}
        <div style={{
          flex: 1,
          textAlign: theme.id === 'classic' ? "center" : "left",
          fontWeight: "bold",
          fontSize: theme.titleBar.fontSize || 11,
          background: theme.titleTextBg,
          color: theme.titleTextColor,
          padding: theme.id === 'classic' ? "0 8px" : "0",
          whiteSpace: "nowrap",
        }}>
          {theme.id === 'terminal' ? `── ${title} ──` : title}
        </div>
        {theme.id === 'classic' && <div style={{ width: 12, flexShrink: 0 }} />}
      </div>
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
      {theme.id === 'classic' && (
        <div style={{
          position: "absolute", bottom: 0, right: 0, width: 16, height: 16,
          backgroundImage: `linear-gradient(135deg, transparent 50%, ${theme.chromeDark} 50%, ${theme.chromeDark} 55%, transparent 55%, transparent 65%, ${theme.chromeDark} 65%, ${theme.chromeDark} 70%, transparent 70%, transparent 80%, ${theme.chromeDark} 80%, ${theme.chromeDark} 85%, transparent 85%)`,
        }} />
      )}
    </div>
  );
}
