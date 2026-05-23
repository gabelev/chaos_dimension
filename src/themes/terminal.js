// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
// Terminal theme — tuned to feel like a real terminal (Tomorrow Night-ish
// palette with muted sage green and magenta accents, soft cream text on
// dark gray). Not the aggressive neon-on-black hacker movie look.
const FONT = `'JetBrains Mono', 'SF Mono', 'Menlo', 'Courier New', monospace`;

const colors = {
  bg: '#2B2B2B',
  windowBg: '#2B2B2B',
  chrome: '#363636',
  chromeDark: '#5C5C5C',
  chromeLight: '#3A3A3A',
  border: '#4A4A4A',
  text: '#E0DCC8',
  textDim: '#8B8675',
  highlight: '#A0BD68',
  highlightText: '#1F1F1F',
  scrollbar: '#5C5C5C',
  titleStripes: '#4A4A4A',
};

const ACCENT = '#A0BD68';        // muted sage (status, success)
const ACCENT_ALT = '#D08CDB';    // magenta-pink (prompts, links)
const SELECTION_BG = '#5A6936';  // dark olive for selection

const GLOBAL_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ${FONT};
    font-size: 13px;
    overflow: hidden;
    background: ${colors.bg};
    color: ${colors.text};
  }
  ::-webkit-scrollbar { width: 10px; }
  ::-webkit-scrollbar-track { background: ${colors.bg}; }
  ::-webkit-scrollbar-thumb { background: ${colors.chromeDark}; border-radius: 0; }
  ::-webkit-scrollbar-thumb:hover { background: ${colors.text}; }
  .mac-btn {
    font-family: ${FONT};
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 0;
    border: 1px solid ${colors.chromeDark};
    background: ${colors.chrome};
    color: ${colors.text};
    cursor: pointer;
  }
  .mac-btn:hover { background: ${colors.chromeLight}; border-color: ${ACCENT}; color: ${ACCENT}; }
  .mac-btn:active { background: ${ACCENT}; color: ${colors.highlightText}; border-color: ${ACCENT}; }
  .mac-btn-primary { background: ${ACCENT}; color: ${colors.highlightText}; border-color: ${ACCENT}; }
  .mac-btn-primary:hover { background: #B8D080; border-color: #B8D080; color: ${colors.highlightText}; }
  .task-card { color: ${colors.text} !important; }
  .task-card:hover { background: ${SELECTION_BG} !important; color: ${colors.text} !important; }
  .col-drop-active { background: ${SELECTION_BG} !important; }
  ::selection { background: ${SELECTION_BG}; color: ${colors.text}; }
  @keyframes blink { 50% { opacity: 0; } }
`;

const theme = {
  id: 'terminal',
  label: 'Terminal',
  FONT,
  ...colors,
  desktopBgImage: 'none',
  desktopBgSize: 'auto',
  titleBarBgImage: 'none',
  titleBarBg: '#1F1F1F',
  titleTextBg: 'transparent',
  titleTextColor: ACCENT_ALT,
  windowBorder: `1px solid ${colors.border}`,
  windowShadow: '0 2px 8px rgba(0,0,0,0.4)',
  cardBorder: `1px solid ${colors.chromeDark}`,
  cardBg: colors.chrome,
  cardHoverBg: SELECTION_BG,
  desktop: {
    minHeight: '100vh',
    background: colors.bg,
    fontFamily: FONT,
    fontSize: 13,
    color: colors.text,
  },
  window: {
    background: colors.chrome,
    border: `1px solid ${colors.border}`,
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  titleBar: {
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 10,
    borderBottom: `1px solid ${colors.border}`,
    fontWeight: 'normal',
    fontSize: 11,
    background: '#1F1F1F',
    color: ACCENT_ALT,
  },
  input: {
    width: '100%',
    padding: '5px 8px',
    fontSize: 13,
    fontFamily: FONT,
    border: `1px solid ${colors.chromeDark}`,
    background: colors.bg,
    color: colors.text,
  },
  button: {
    fontFamily: FONT,
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 0,
    border: `1px solid ${colors.chromeDark}`,
    background: colors.chrome,
    color: colors.text,
    cursor: 'pointer',
  },
  link: {
    color: ACCENT_ALT,
    textDecoration: 'underline',
    fontFamily: FONT,
    fontSize: 13,
    cursor: 'pointer',
  },
  GLOBAL_CSS,
};

export default theme;
