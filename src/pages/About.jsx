// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { Link } from 'react-router-dom';
import { useTheme } from '../themes';
import Attribution from '../components/Attribution';

export default function About() {
  const { theme } = useTheme();
  return (
    <div style={{ ...theme.desktop, padding: 24, overflow: 'auto' }}>
      <div
        style={{
          background: theme.chrome,
          border: theme.windowBorder,
          maxWidth: 640,
          margin: '40px auto',
          boxShadow: theme.windowShadow || '4px 4px 0 rgba(0,0,0,0.3)',
          color: theme.text,
          fontFamily: theme.FONT,
          borderRadius: theme.window.borderRadius || 0,
          overflow: 'hidden',
        }}
      >
        <div style={{
          height: theme.titleBar.height || 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: theme.id === 'classic' ? 'center' : 'flex-start',
          paddingLeft: theme.id === 'classic' ? 0 : 12,
          borderBottom: theme.titleBar.borderBottom || `1px solid ${theme.border}`,
          fontWeight: 'bold',
          fontSize: theme.titleBar.fontSize || 12,
          background: theme.titleBarBg,
          backgroundImage: theme.titleBarBgImage,
          color: theme.titleTextColor,
          textTransform: theme.titleBar.textTransform || 'none',
          letterSpacing: theme.titleBar.letterSpacing || 'normal',
        }}>
          <span style={{
            background: theme.titleTextBg,
            padding: theme.id === 'classic' ? '0 10px' : '0',
            color: theme.titleTextColor,
          }}>
            {theme.id === 'terminal' ? '── About Chaos Dimension ──' : 'About Chaos Dimension'}
          </span>
        </div>
        <div style={{ padding: 20, background: theme.windowBg, lineHeight: 1.6 }}>
          <p style={{ marginBottom: 12 }}>
            I wanted a JIRA, but for me. A control panel for dispatching coding agents and watching them work.
            I built it, and made it look like a 1991 Macintosh.
          </p>
          <p style={{ marginBottom: 12 }}>
            "Chaos dimension" is a lyric from{' '}
            <a
              href="https://open.spotify.com/track/7xhZCVsVhDSjhFm41mOX10"
              target="_blank"
              rel="noreferrer"
              style={theme.link}
            >
              "Almost Had to Start a Fight / In and Out of Patience"
            </a>{' '}
            by Parquet Courts, a Brooklyn band.
          </p>
          <p style={{ marginBottom: 12 }}>
            Source:{' '}
            <a
              href="https://github.com/gabelev/chaos_dimension"
              target="_blank"
              rel="noreferrer"
              style={theme.link}
            >
              github.com/gabelev/chaos_dimension
            </a>
          </p>
          <p style={{ marginBottom: 12 }}>
            <Attribution linkStyle={theme.link} />
          </p>
          <p style={{ marginTop: 20 }}>
            <Link to="/" style={theme.link}>← Back</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
