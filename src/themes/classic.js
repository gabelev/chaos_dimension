// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
const FONT = `'Geneva', 'Lucida Grande', 'Helvetica Neue', sans-serif`;

const colors = {
  bg: '#5A7DC8',
  windowBg: '#FFFFFF',
  chrome: '#DDDDDD',
  chromeDark: '#999999',
  chromeLight: '#EEEEEE',
  border: '#000000',
  text: '#000000',
  textDim: '#555555',
  highlight: '#000080',
  highlightText: '#FFFFFF',
  scrollbar: '#CCCCCC',
  titleStripes: '#BBBBBB',
};

const GLOBAL_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ${FONT};
    font-size: 12px;
    overflow: hidden;
  }
  ::-webkit-scrollbar { width: 16px; }
  ::-webkit-scrollbar-track { background: ${colors.chrome}; border-left: 1px solid ${colors.border}; }
  ::-webkit-scrollbar-thumb { background: ${colors.scrollbar}; border: 1px solid ${colors.border}; }
  .mac-btn {
    font-family: ${FONT};
    font-size: 12px;
    padding: 3px 16px;
    border-radius: 6px;
    border: 2px solid ${colors.border};
    background: ${colors.chrome};
    color: ${colors.text};
    cursor: pointer;
  }
  .mac-btn:active { background: ${colors.border}; color: #fff; }
  .mac-btn-primary { background: ${colors.border}; color: #fff; }
  .mac-btn-primary:active { background: ${colors.chromeDark}; }
  .task-card:hover { background: #E8E8FF !important; }
  .col-drop-active { background: #D0D0FF !important; }
  @keyframes blink { 50% { opacity: 0; } }
`;

const theme = {
  id: 'classic',
  label: 'Classic (Mac OS 7)',
  FONT,
  ...colors,
  desktopBgImage: 'repeating-conic-gradient(#5070B8 0% 25%, transparent 0% 50%)',
  desktopBgSize: '4px 4px',
  titleBarBgImage: `repeating-linear-gradient(
    transparent 0px, transparent 1px,
    ${colors.titleStripes} 1px, ${colors.titleStripes} 2px,
    transparent 2px, transparent 3px
  )`,
  titleBarBg: 'transparent',
  titleTextBg: colors.chrome,
  titleTextColor: colors.text,
  windowBorder: `2px solid ${colors.border}`,
  windowShadow: '4px 4px 0 rgba(0,0,0,0.3)',
  cardBorder: `1px solid ${colors.chromeDark}`,
  cardBg: '#FFFFFF',
  cardHoverBg: '#E8E8FF',
  desktop: {
    minHeight: '100vh',
    background: colors.bg,
    backgroundImage: 'repeating-conic-gradient(#5070B8 0% 25%, transparent 0% 50%)',
    backgroundSize: '4px 4px',
    fontFamily: FONT,
    fontSize: 12,
  },
  window: {
    background: colors.chrome,
    border: `2px solid ${colors.border}`,
    boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
  },
  titleBar: {
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: `1px solid ${colors.border}`,
    fontWeight: 'bold',
    fontSize: 12,
    backgroundImage: `repeating-linear-gradient(
      transparent 0px, transparent 1px,
      ${colors.titleStripes} 1px, ${colors.titleStripes} 2px,
      transparent 2px, transparent 3px
    )`,
  },
  input: {
    width: '100%',
    padding: '3px 4px',
    fontSize: 12,
    fontFamily: FONT,
    border: `2px inset ${colors.chromeDark}`,
    background: '#fff',
  },
  button: {
    fontFamily: FONT,
    fontSize: 12,
    padding: '3px 16px',
    borderRadius: 6,
    border: `2px solid ${colors.border}`,
    background: colors.chrome,
    cursor: 'pointer',
  },
  link: {
    color: colors.highlight,
    textDecoration: 'underline',
    fontFamily: FONT,
    fontSize: 12,
    cursor: 'pointer',
  },
  GLOBAL_CSS,
};

export default theme;
