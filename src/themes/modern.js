// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

const colors = {
  bg: '#F4F5F7',
  windowBg: '#FFFFFF',
  chrome: '#FFFFFF',
  chromeDark: '#DFE1E6',
  chromeLight: '#F4F5F7',
  border: '#DFE1E6',
  text: '#172B4D',
  textDim: '#6B778C',
  highlight: '#0052CC',
  highlightText: '#FFFFFF',
  scrollbar: '#C1C7D0',
  titleStripes: '#DFE1E6',
};

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
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #C1C7D0; border-radius: 5px; }
  ::-webkit-scrollbar-thumb:hover { background: #A5ADBA; }
  .mac-btn {
    font-family: ${FONT};
    font-size: 13px;
    font-weight: 500;
    padding: 6px 14px;
    border-radius: 3px;
    border: 1px solid ${colors.chromeDark};
    background: ${colors.chrome};
    color: ${colors.text};
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .mac-btn:hover { background: ${colors.chromeLight}; }
  .mac-btn:active { background: #EBECF0; }
  .mac-btn-primary { background: ${colors.highlight}; color: #fff; border-color: ${colors.highlight}; }
  .mac-btn-primary:hover { background: #0747A6; border-color: #0747A6; }
  .task-card { box-shadow: 0 1px 2px rgba(9,30,66,0.08); border-radius: 3px !important; }
  .task-card:hover { background: ${colors.chromeLight} !important; }
  .col-drop-active { background: #DEEBFF !important; }
  @keyframes blink { 50% { opacity: 0; } }
`;

const theme = {
  id: 'modern',
  label: 'Modern',
  FONT,
  ...colors,
  desktopBgImage: 'none',
  desktopBgSize: 'auto',
  titleBarBgImage: 'none',
  titleBarBg: colors.chrome,
  titleTextBg: 'transparent',
  titleTextColor: colors.text,
  windowBorder: `1px solid ${colors.chromeDark}`,
  windowShadow: '0 1px 3px rgba(9,30,66,0.16)',
  cardBorder: `1px solid ${colors.chromeDark}`,
  cardBg: colors.windowBg,
  cardHoverBg: colors.chromeLight,
  desktop: {
    minHeight: '100vh',
    background: colors.bg,
    fontFamily: FONT,
    fontSize: 13,
    color: colors.text,
  },
  window: {
    background: colors.windowBg,
    border: `1px solid ${colors.chromeDark}`,
    boxShadow: '0 1px 3px rgba(9,30,66,0.16)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  titleBar: {
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 16,
    borderBottom: `1px solid ${colors.chromeDark}`,
    fontWeight: 600,
    fontSize: 14,
    background: colors.chrome,
    color: colors.text,
  },
  input: {
    width: '100%',
    padding: '6px 10px',
    fontSize: 13,
    fontFamily: FONT,
    border: `1px solid ${colors.chromeDark}`,
    background: colors.windowBg,
    borderRadius: 3,
    color: colors.text,
  },
  button: {
    fontFamily: FONT,
    fontSize: 13,
    padding: '6px 14px',
    borderRadius: 3,
    border: `1px solid ${colors.chromeDark}`,
    background: colors.chrome,
    cursor: 'pointer',
  },
  link: {
    color: colors.highlight,
    textDecoration: 'none',
    fontFamily: FONT,
    fontSize: 13,
    cursor: 'pointer',
  },
  GLOBAL_CSS,
};

export default theme;
