// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
const FONT = `'Helvetica Neue', 'Arial', sans-serif`;

const colors = {
  bg: '#FFFFFF',
  windowBg: '#FFFFFF',
  chrome: '#FFFFFF',
  chromeDark: '#000000',
  chromeLight: '#F5F5F5',
  border: '#000000',
  text: '#000000',
  textDim: '#666666',
  highlight: '#FF3333',
  highlightText: '#FFFFFF',
  scrollbar: '#000000',
  titleStripes: '#000000',
};

const GLOBAL_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ${FONT};
    font-size: 12px;
    overflow: hidden;
    background: #FFF;
  }
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: #FFF; border-left: 1px solid #000; }
  ::-webkit-scrollbar-thumb { background: #000; }
  .mac-btn {
    font-family: ${FONT};
    font-size: 12px;
    padding: 4px 14px;
    border-radius: 0;
    border: 1px solid #000;
    background: #FFF;
    color: #000;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .mac-btn:hover { background: #000; color: #FFF; }
  .mac-btn:active { background: #FF3333; color: #FFF; border-color: #FF3333; }
  .mac-btn-primary { background: #000; color: #FFF; }
  .mac-btn-primary:hover { background: #FF3333; border-color: #FF3333; }
  .task-card:hover { background: #F5F5F5 !important; }
  .col-drop-active { background: #FFF3F3 !important; outline: 2px solid #FF3333; outline-offset: -2px; }
  @keyframes blink { 50% { opacity: 0; } }
`;

const theme = {
  id: 'minimal',
  label: 'Minimal',
  FONT,
  ...colors,
  desktopBgImage: 'none',
  desktopBgSize: 'auto',
  titleBarBgImage: 'none',
  titleBarBg: '#000000',
  titleTextBg: 'transparent',
  titleTextColor: '#FFFFFF',
  windowBorder: '1px solid #000',
  windowShadow: 'none',
  cardBorder: '1px solid #000',
  cardBg: '#FFFFFF',
  cardHoverBg: '#F5F5F5',
  desktop: {
    minHeight: '100vh',
    background: '#FFFFFF',
    fontFamily: FONT,
    fontSize: 12,
  },
  window: {
    background: '#FFFFFF',
    border: '1px solid #000',
    boxShadow: 'none',
  },
  titleBar: {
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 12,
    borderBottom: '1px solid #000',
    fontWeight: 'bold',
    fontSize: 11,
    background: '#000000',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  input: {
    width: '100%',
    padding: '6px 8px',
    fontSize: 12,
    fontFamily: FONT,
    border: '1px solid #000',
    background: '#FFF',
  },
  button: {
    fontFamily: FONT,
    fontSize: 12,
    padding: '4px 14px',
    borderRadius: 0,
    border: '1px solid #000',
    background: '#FFF',
    cursor: 'pointer',
    textTransform: 'uppercase',
  },
  link: {
    color: '#FF3333',
    textDecoration: 'underline',
    fontFamily: FONT,
    fontSize: 12,
    cursor: 'pointer',
  },
  GLOBAL_CSS,
};

export default theme;
