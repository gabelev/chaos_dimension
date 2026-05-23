// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
export const MAC = {
  bg: "#5A7DC8",
  windowBg: "#FFFFFF",
  chrome: "#DDDDDD",
  chromeDark: "#999999",
  chromeLight: "#EEEEEE",
  border: "#000000",
  text: "#000000",
  textDim: "#555555",
  highlight: "#000080",
  highlightText: "#FFFFFF",
  scrollbar: "#CCCCCC",
  titleStripes: "#BBBBBB",

  desktop: {
    minHeight: "100vh",
    background: "#5A7DC8",
    backgroundImage: "repeating-conic-gradient(#5070B8 0% 25%, transparent 0% 50%)",
    backgroundSize: "4px 4px",
    fontFamily: `'Geneva', 'Lucida Grande', 'Helvetica Neue', sans-serif`,
    fontSize: 12,
  },
  window: {
    background: "#DDDDDD",
    border: "2px solid #000",
    boxShadow: "4px 4px 0 rgba(0,0,0,0.3)",
  },
  titleBar: {
    height: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderBottom: "1px solid #000",
    fontWeight: "bold",
    fontSize: 12,
    backgroundImage: `repeating-linear-gradient(
      transparent 0px, transparent 1px,
      #BBBBBB 1px, #BBBBBB 2px,
      transparent 2px, transparent 3px
    )`,
  },
  input: {
    width: "100%",
    padding: "3px 4px",
    fontSize: 12,
    fontFamily: `'Geneva', 'Lucida Grande', 'Helvetica Neue', sans-serif`,
    border: "2px inset #999",
    background: "#fff",
  },
  button: {
    fontFamily: `'Geneva', 'Lucida Grande', 'Helvetica Neue', sans-serif`,
    fontSize: 12,
    padding: "3px 16px",
    borderRadius: 6,
    border: "2px solid #000",
    background: "#DDDDDD",
    cursor: "pointer",
  },
  link: {
    color: "#000080",
    textDecoration: "underline",
    fontFamily: `'Geneva', 'Lucida Grande', 'Helvetica Neue', sans-serif`,
    fontSize: 12,
    cursor: "pointer",
  },
};

export const FONT = `'Geneva', 'Lucida Grande', 'Helvetica Neue', sans-serif`;

export const GLOBAL_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ${FONT};
    font-size: 12px;
    overflow: hidden;
  }
  ::-webkit-scrollbar { width: 16px; }
  ::-webkit-scrollbar-track { background: ${MAC.chrome}; border-left: 1px solid ${MAC.border}; }
  ::-webkit-scrollbar-thumb { background: ${MAC.scrollbar}; border: 1px solid ${MAC.border}; }
  .mac-btn {
    font-family: ${FONT};
    font-size: 12px;
    padding: 3px 16px;
    border-radius: 6px;
    border: 2px solid ${MAC.border};
    background: ${MAC.chrome};
    cursor: pointer;
  }
  .mac-btn:active { background: ${MAC.border}; color: #fff; }
  .mac-btn-primary { background: ${MAC.border}; color: #fff; }
  .mac-btn-primary:active { background: ${MAC.chromeDark}; }
  .task-card:hover { background: #E8E8FF !important; }
  .col-drop-active { background: #D0D0FF !important; }
  @keyframes blink { 50% { opacity: 0; } }
`;
