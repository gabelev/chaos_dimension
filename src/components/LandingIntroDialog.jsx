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
import { useTheme } from '../themes';

const AUTO_DISMISS_MS = 5000;

const MCP_TOOLS = [
  'list_tasks',
  'create_task',
  'update_task',
  'claim_task',
  'list_workstreams',
  'report_progress',
  'get_task',
];

const FEATURES = [
  {
    title: 'Kanban board',
    body: 'Backlog, active, review, done. Drag cards, set priorities, organize into workstreams.',
  },
  {
    title: 'MCP-native',
    body: 'Connect Claude, ChatGPT, Cursor, or any MCP client. Agents claim tasks and report progress.',
  },
  {
    title: 'Agent dispatch',
    body: 'Flag tasks as agent-dispatchable. Your coding agents pick them up and execute autonomously.',
  },
];

export default function LandingIntroDialog({ onClose }) {
  const { theme } = useTheme();
  const [remaining, setRemaining] = useState(Math.ceil(AUTO_DISMISS_MS / 1000));

  useEffect(() => {
    const closeTimer = setTimeout(onClose, AUTO_DISMISS_MS);
    const tickTimer = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => {
      clearTimeout(closeTimer);
      clearInterval(tickTimer);
    };
  }, [onClose]);

  const monoFont = `'Monaco', 'Courier New', monospace`;

  return (
    <div
      role="dialog"
      aria-label="About Chaos Dimension"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.chrome,
          border: theme.windowBorder,
          width: 'min(560px, 100%)',
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: theme.windowShadow || '4px 4px 0 rgba(0,0,0,0.3)',
          color: theme.text,
          fontFamily: theme.FONT,
          borderRadius: theme.window.borderRadius || 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: theme.titleBar.height || 22,
            display: 'flex',
            alignItems: 'center',
            padding: '0 6px',
            borderBottom: theme.titleBar.borderBottom || `1px solid ${theme.border}`,
            background: theme.titleBarBg,
            backgroundImage: theme.titleBarBgImage,
            color: theme.titleTextColor,
            fontWeight: theme.titleBar.fontWeight || 'bold',
            fontSize: theme.titleBar.fontSize || 12,
            textTransform: theme.titleBar.textTransform || 'none',
            letterSpacing: theme.titleBar.letterSpacing || 'normal',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={{
              width: 14,
              height: 14,
              border: `1px solid ${theme.border}`,
              background: theme.chrome,
              padding: 0,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: theme.titleBar.fontSize || 12,
              color: theme.titleTextColor,
            }}
          >
            <span
              style={{
                background: theme.titleTextBg,
                padding: theme.id === 'classic' ? '0 10px' : '0',
                color: theme.titleTextColor,
              }}
            >
              {theme.id === 'terminal' ? '── Welcome to Chaos Dimension ──' : 'Welcome to Chaos Dimension'}
            </span>
          </div>
          <div style={{ width: 14, flexShrink: 0 }} />
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: theme.windowBg,
            padding: '18px 22px',
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: theme.textDim,
              marginBottom: 6,
              fontWeight: 'bold',
            }}
          >
            Open source · AGPL-3.0
          </div>
          <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8, color: theme.text }}>
            Chaos Dimension
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.55, color: theme.textDim, marginBottom: 16 }}>
            A lightweight, MCP-native project board that your AI agents can read, write, and act on.
            Kanban for humans. API for agents. One shared surface.
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 8,
              marginBottom: 16,
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  background: theme.chrome,
                  border: theme.cardBorder || `1px solid ${theme.border}`,
                  padding: '8px 10px',
                  borderRadius: theme.window.borderRadius || 0,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 4, color: theme.text }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.45, color: theme.textDim }}>{f.body}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.08em',
                color: theme.textDim,
                marginBottom: 6,
                fontWeight: 'bold',
              }}
            >
              MCP TOOLS
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {MCP_TOOLS.map((t) => (
                <span
                  key={t}
                  style={{
                    fontFamily: monoFont,
                    fontSize: 11,
                    background: theme.chrome,
                    border: `1px solid ${theme.chromeDark || theme.border}`,
                    color: theme.text,
                    padding: '1px 8px',
                    borderRadius: theme.window.borderRadius ? 4 : 0,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.08em',
                color: theme.textDim,
                marginBottom: 6,
                fontWeight: 'bold',
              }}
            >
              CONNECT IN 30 SECONDS
            </div>
            <pre
              style={{
                fontFamily: monoFont,
                fontSize: 11,
                lineHeight: 1.55,
                background: theme.chrome,
                border: `1px solid ${theme.chromeDark || theme.border}`,
                padding: '8px 10px',
                margin: 0,
                color: theme.text,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
{`// claude_desktop_config.json
{
  "mcpServers": {
    "chaos-dimension": {
      "url": "https://www.chaosdimension.fyi/api/mcp"
    }
  }
}`}
            </pre>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <a
              href="https://github.com/gabelev/chaos_dimension"
              target="_blank"
              rel="noreferrer noopener"
              className="mac-btn"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            >
              GitHub →
            </a>
            <a
              href="https://www.chaosdimension.fyi"
              target="_blank"
              rel="noreferrer noopener"
              className="mac-btn mac-btn-primary"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            >
              Try hosted →
            </a>
          </div>

          <div style={{ fontSize: 10, color: theme.textDim, textAlign: 'center' }}>
            {remaining > 0
              ? `Auto-closing in ${remaining}s · click outside or × to dismiss`
              : 'Closing…'}
          </div>
        </div>
      </div>
    </div>
  );
}
