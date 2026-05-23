// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import App from './App';
import { useTheme } from '../themes';
import WaitlistForm from '../components/WaitlistForm';
import LandingIntroDialog from '../components/LandingIntroDialog';

export default function Landing() {
  const { theme } = useTheme();
  const [introOpen, setIntroOpen] = useState(true);
  return (
    <div style={{ position: 'relative' }}>
      {introOpen && <LandingIntroDialog onClose={() => setIntroOpen(false)} />}
      <div
        style={{
          position: 'fixed',
          top: 28,
          right: 8,
          zIndex: 9999,
          background: theme.chrome,
          border: theme.windowBorder,
          boxShadow: theme.windowShadow || '3px 3px 0 rgba(0,0,0,0.3)',
          minWidth: 220,
          borderRadius: theme.window.borderRadius || 0,
          overflow: 'hidden',
          fontFamily: theme.FONT,
          color: theme.text,
        }}
      >
        <div style={{
          height: theme.titleBar.height || 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: theme.id === 'classic' ? 'center' : 'flex-start',
          paddingLeft: theme.id === 'classic' ? 0 : 10,
          borderBottom: theme.titleBar.borderBottom || `1px solid ${theme.border}`,
          fontWeight: 'bold',
          fontSize: 11,
          background: theme.titleBarBg,
          backgroundImage: theme.titleBarBgImage,
          color: theme.titleTextColor,
          textTransform: theme.titleBar.textTransform || 'none',
          letterSpacing: theme.titleBar.letterSpacing || 'normal',
        }}>
          <span style={{
            background: theme.titleTextBg,
            padding: theme.id === 'classic' ? '0 8px' : '0',
            color: theme.titleTextColor,
          }}>
            {theme.id === 'terminal' ? '── Demo ──' : 'Demo'}
          </span>
        </div>
        <div
          style={{
            padding: '8px 10px',
            background: theme.windowBg,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 11,
          }}
        >
          <a
            href="https://github.com/gabelev/chaos_dimension"
            target="_blank"
            rel="noreferrer"
            style={theme.link}
          >
            → View source on GitHub
          </a>
          <Link to="/about" style={theme.link}>
            → About this project
          </Link>
          <Link to="/login" style={theme.link}>
            → Login
          </Link>
        </div>
      </div>
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          right: 8,
          zIndex: 9999,
          width: 280,
          boxShadow: theme.windowShadow || '3px 3px 0 rgba(0,0,0,0.3)',
          fontFamily: theme.FONT,
        }}
      >
        <WaitlistForm />
      </div>
      <App mode="demo" />
    </div>
  );
}
