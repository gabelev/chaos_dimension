// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.

// Notional — a Notion-style skin: warm off-white canvas, near-black warm text
// (#37352F), hairline #E9E9E7 borders, soft shadows, gentle radii, and the
// Notion blue (#2383E2) as the single accent.
//
// Inter is the closest free match to Notion's UI sans (loaded via @import in
// GLOBAL_CSS); the system stack falls in behind it.
const FONT = `'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

const colors = {
  bg: '#F7F6F3',          // warm page/desktop background
  windowBg: '#FFFFFF',
  chrome: '#FFFFFF',
  chromeDark: '#E9E9E7',  // hairline border
  chromeLight: '#F1F1EF', // hover / subtle fill
  border: '#E9E9E7',
  text: '#37352F',        // Notion warm near-black
  textDim: '#9B9A97',     // muted gray
  highlight: '#2383E2',   // Notion blue accent
  highlightText: '#FFFFFF',
  scrollbar: '#D3D1CB',
  titleStripes: '#E9E9E7',
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ${FONT};
    font-size: 14px;
    overflow: hidden;
    background: ${colors.bg};
    color: ${colors.text};
    -webkit-font-smoothing: antialiased;
  }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${colors.scrollbar}; border-radius: 5px; }
  ::-webkit-scrollbar-thumb:hover { background: #B9B7B0; }
  .mac-btn {
    font-family: ${FONT};
    font-size: 14px;
    font-weight: 500;
    padding: 5px 12px;
    border-radius: 5px;
    border: 1px solid ${colors.chromeDark};
    background: ${colors.chrome};
    color: ${colors.text};
    cursor: pointer;
    transition: background 0.12s ease;
  }
  .mac-btn:hover { background: ${colors.chromeLight}; }
  .mac-btn:active { background: #E6E6E4; }
  .mac-btn-primary { background: ${colors.highlight}; color: #fff; border-color: ${colors.highlight}; }
  .mac-btn-primary:hover { background: #1A6DC4; border-color: #1A6DC4; }
  .task-card { border-radius: 5px !important; transition: background 0.12s ease; }
  .task-card:hover { background: ${colors.chromeLight} !important; }
  .col-drop-active { background: #E7F3F8 !important; }
  @keyframes blink { 50% { opacity: 0; } }
`;

const theme = {
  id: 'notional',
  label: 'Notional',
  FONT,
  ...colors,
  desktopBgImage: 'none',
  desktopBgSize: 'auto',
  titleBarBgImage: 'none',
  titleBarBg: colors.chrome,
  titleTextBg: 'transparent',
  titleTextColor: colors.text,
  windowBorder: `1px solid ${colors.chromeDark}`,
  windowShadow: 'rgba(15,15,15,0.04) 0px 0px 0px 1px, rgba(15,15,15,0.08) 0px 2px 6px',
  cardBorder: `1px solid ${colors.chromeDark}`,
  cardBg: colors.windowBg,
  cardHoverBg: colors.chromeLight,
  // Notion-style kanban column headers: title-case status text tinted by the
  // per-column color, with a plain gray count (no bordered pill). App.jsx reads
  // these and falls back to its default styling for themes that omit them.
  columnHeader: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '-0.01em',
    textTransform: 'none',
  },
  columnColors: {
    backlog: '#C4554D', // red
    active: '#CC782F',  // orange
    review: '#487CA5',  // blue
    done: '#548164',    // green
  },
  columnCount: {
    fontSize: 14,
    fontWeight: 500,
    color: colors.textDim,
    background: 'transparent',
    border: 'none',
    padding: '0 4px',
  },
  desktop: {
    minHeight: '100vh',
    background: colors.bg,
    fontFamily: FONT,
    fontSize: 14,
    color: colors.text,
  },
  window: {
    background: colors.windowBg,
    border: `1px solid ${colors.chromeDark}`,
    boxShadow: 'rgba(15,15,15,0.04) 0px 0px 0px 1px, rgba(15,15,15,0.08) 0px 2px 6px',
    borderRadius: 6,
    overflow: 'hidden',
  },
  titleBar: {
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 16,
    borderBottom: `1px solid ${colors.chromeDark}`,
    fontWeight: 700,
    fontSize: 16,
    background: colors.chrome,
    color: colors.text,
    textTransform: 'none',
    letterSpacing: '-0.01em',
  },
  input: {
    width: '100%',
    padding: '6px 10px',
    fontSize: 14,
    fontFamily: FONT,
    border: `1px solid ${colors.chromeDark}`,
    background: colors.windowBg,
    borderRadius: 5,
    color: colors.text,
  },
  button: {
    fontFamily: FONT,
    fontSize: 14,
    padding: '5px 12px',
    borderRadius: 5,
    border: `1px solid ${colors.chromeDark}`,
    background: colors.chrome,
    cursor: 'pointer',
  },
  link: {
    color: colors.highlight,
    textDecoration: 'none',
    fontFamily: FONT,
    fontSize: 14,
    cursor: 'pointer',
  },
  GLOBAL_CSS,
};

export default theme;
