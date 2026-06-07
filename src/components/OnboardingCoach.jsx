// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../themes';
import { api } from '../lib/api';

const POLL_MS = 10_000;
const COACH_W = 280;
const COACH_H = 210;
const MARGIN = 16;

export default function OnboardingCoach({ open, onClose }) {
  const { theme } = useTheme();
  const [state, setState] = useState(null);
  const [activeTab, setActiveTab] = useState('claude');
  const [celebrate, setCelebrate] = useState(false);
  const [pos, setPos] = useState(() => ({
    x: typeof window !== 'undefined' ? window.innerWidth - COACH_W - MARGIN : MARGIN,
    y: typeof window !== 'undefined' ? window.innerHeight - COACH_H - MARGIN : MARGIN,
  }));
  const dragRef = useRef(null);

  // Poll while open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let timer;
    const tick = async () => {
      try {
        const next = await api.getOnboarding();
        if (cancelled) return;
        setState(next);
      } catch { /* keep polling */ }
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open]);

  // Both checked → celebrate ~3s → auto-close + persist dismissal.
  useEffect(() => {
    if (!state) return;
    if (state.has_connected_ai && state.has_mcp_created_task && !celebrate) {
      setCelebrate(true);
      const t = setTimeout(async () => {
        try { await api.dismissOnboarding(); } catch { /* ignore */ }
        onClose();
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [state, celebrate, onClose]);

  // Drag from title bar.
  const onMouseDownTitle = (e) => {
    if (e.target.closest('[data-close-box]')) return;
    const startX = e.clientX, startY = e.clientY;
    const startPos = { ...pos };
    const onMove = (ev) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - COACH_W, startPos.x + ev.clientX - startX)),
        y: Math.max(0, Math.min(window.innerHeight - COACH_H, startPos.y + ev.clientY - startY)),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const dismissForever = async () => {
    try { await api.dismissOnboarding(); } catch { /* ignore */ }
    onClose();
  };

  if (!open) return null;

  const item1Done = !!state?.has_connected_ai;
  const item2Done = !!state?.has_mcp_created_task;

  return (
    <div
      ref={dragRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: COACH_W,
        height: COACH_H,
        zIndex: 100,
        border: theme.windowBorder,
        boxShadow: theme.windowShadow || '2px 2px 0 rgba(0,0,0,0.3)',
        background: theme.windowBg,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: theme.FONT,
        color: theme.text,
        userSelect: 'none',
      }}
    >
      {/* Title bar */}
      <div
        onMouseDown={onMouseDownTitle}
        style={{
          height: theme.titleBar.height || 20,
          display: 'flex',
          alignItems: 'center',
          padding: '0 4px',
          background: theme.titleBarBg,
          backgroundImage: theme.titleBarBgImage,
          borderBottom: theme.titleBar.borderBottom || `1px solid ${theme.border}`,
          color: theme.titleTextColor,
          cursor: 'move',
          flexShrink: 0,
        }}
      >
        {theme.id === 'classic' && (
          <div
            data-close-box
            onClick={onClose}
            style={{
              width: 12, height: 12, border: `1px solid ${theme.border}`,
              background: theme.chrome, marginRight: 6, cursor: 'pointer', flexShrink: 0,
            }}
          />
        )}
        <div style={{
          flex: 1,
          textAlign: theme.id === 'classic' ? 'center' : 'left',
          fontWeight: 'bold',
          fontSize: theme.titleBar.fontSize || 11,
          padding: theme.id === 'classic' ? '0 8px' : '0',
          background: theme.titleTextBg,
        }}>
          Getting Started
        </div>
        {theme.id === 'classic' && <div style={{ width: 12, flexShrink: 0 }} />}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {celebrate ? (
          <div style={{ textAlign: 'center', padding: '40px 8px', fontSize: 13 }}>
            You're set up. ✨
          </div>
        ) : (
          <>
            <ChecklistRow checked={item1Done} label="Connect an AI" theme={theme}>
              {!item1Done && (
                <>
                  <Tabs
                    theme={theme}
                    active={activeTab}
                    onChange={setActiveTab}
                    tabs={[
                      { id: 'claude', label: 'Claude' },
                      { id: 'chatgpt', label: 'ChatGPT' },
                      { id: 'claude-code', label: 'Claude Code' },
                    ]}
                  />
                  <TabBody tab={activeTab} theme={theme} />
                </>
              )}
            </ChecklistRow>

            <div style={{ height: 6 }} />

            <ChecklistRow checked={item2Done} label="Ask your AI to create a task" theme={theme}>
              {!item2Done && (
                <div style={{ fontSize: 11, lineHeight: 1.4 }}>
                  In Claude or ChatGPT, try:
                  <div style={{ fontStyle: 'italic', margin: '4px 0', color: theme.textDim }}>
                    ⚡ "Create a task in Chaos Dimension called Test from Claude in the second-seat workstream."
                  </div>
                  When you see it appear on the board, you're done.
                </div>
              )}
            </ChecklistRow>
          </>
        )}
      </div>

      {/* Footer */}
      {!celebrate && (
        <div style={{
          padding: '4px 8px',
          borderTop: `1px solid ${theme.chromeDark}`,
          fontSize: 10,
          color: theme.textDim,
          textAlign: 'right',
          flexShrink: 0,
        }}>
          <span onClick={dismissForever} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
            Don't show again
          </span>
        </div>
      )}
    </div>
  );
}

function ChecklistRow({ checked, label, theme, children }) {
  return (
    <div style={{
      border: `2px inset ${theme.chromeDark}`,
      padding: 6,
      background: theme.windowBg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 'bold' }}>
        <div style={{
          width: 12, height: 12,
          border: `1px outset ${theme.chromeDark}`,
          background: theme.chrome,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, lineHeight: 1,
        }}>
          {checked ? '✓' : ''}
        </div>
        <span>{label}</span>
      </div>
      {children && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  );
}

function Tabs({ tabs, active, onChange, theme }) {
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${theme.border}`, marginBottom: 6 }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className="mac-btn"
          style={{
            flex: 1,
            fontSize: 11,
            padding: '2px 4px',
            background: active === t.id ? theme.highlight : theme.chrome,
            color: active === t.id ? theme.highlightText : theme.text,
            border: `1px solid ${theme.chromeDark}`,
            cursor: 'pointer',
          }}
        >{t.label}</button>
      ))}
    </div>
  );
}

function TabBody({ tab, theme }) {
  if (tab === 'claude') {
    return (
      <div style={{ fontSize: 11, lineHeight: 1.4 }}>
        Works with Claude Pro, Max, Team, or Enterprise. Free works too via Claude Desktop or Claude Code.
        <div style={{ marginTop: 6 }}>
          <a href="/connect#claude" className="mac-btn mac-btn-primary" style={{ fontSize: 11, textDecoration: 'none' }}>
            Open Claude setup →
          </a>
        </div>
      </div>
    );
  }
  if (tab === 'chatgpt') {
    return (
      <div style={{ fontSize: 11, lineHeight: 1.4 }}>
        Works with ChatGPT Plus, Pro, Business, Enterprise, or Edu. Free tier doesn't support MCP connectors yet.
        <div style={{ marginTop: 6 }}>
          <a href="/connect#chatgpt" className="mac-btn mac-btn-primary" style={{ fontSize: 11, textDecoration: 'none' }}>
            Open ChatGPT setup →
          </a>
        </div>
      </div>
    );
  }
  return (
    <div style={{ fontSize: 11, lineHeight: 1.4 }}>
      Any plan. Run <code>claude mcp add chaos-dimension …</code> — full command on the setup page.
      <div style={{ marginTop: 6 }}>
        <a href="/connect#claude-code" className="mac-btn mac-btn-primary" style={{ fontSize: 11, textDecoration: 'none' }}>
          Open Claude Code setup →
        </a>
      </div>
    </div>
  );
}
