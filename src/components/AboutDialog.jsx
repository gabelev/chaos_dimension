// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { useTheme } from '../themes';
import ModalShell from './ModalShell';
import Attribution from './Attribution';

export default function AboutDialog({ onClose }) {
  const { theme } = useTheme();
  return (
    <ModalShell title=" " onClose={onClose} width={320} zIndex={400}>
      <div style={{ padding: '24px 20px', background: theme.windowBg, textAlign: 'center', color: theme.text }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>◉</div>
        <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>Chaos Dimension</div>
        <div style={{ fontSize: 11, color: theme.textDim, marginBottom: 12 }}>
          Summer '26 Mission Control<br />
          Kanban × Agent Orchestration<br />
          v0.3
        </div>
        <div style={{ fontSize: 10, color: theme.textDim, marginBottom: 12, fontStyle: 'italic' }}>
          I wanted a light weight Jira to seamlessly integrate with claude code and track agent progress for all my projects.
        </div>
        <div style={{ fontSize: 10, color: theme.textDim, marginBottom: 16 }}>
          <Attribution
            textStyle={{ color: theme.textDim }}
            linkStyle={{ color: theme.highlight, textDecoration: 'underline' }}
          />
        </div>
        <button className="mac-btn mac-btn-primary" onClick={onClose} style={{ minWidth: 80 }}>
          OK
        </button>
      </div>
    </ModalShell>
  );
}
