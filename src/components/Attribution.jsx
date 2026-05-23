// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
export default function Attribution({ linkStyle, textStyle }) {
  return (
    <span style={textStyle}>
      Created by{' '}
      <a
        href="https://github.com/gabelev"
        target="_blank"
        rel="noreferrer"
        style={linkStyle}
      >
        Putu Gabe Levine
      </a>
      {' '}with help from Claude.
    </span>
  );
}
