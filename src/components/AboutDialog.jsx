import { MAC } from '../styles/mac';
import Attribution from './Attribution';

export default function AboutDialog({ onClose }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400,
      }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: MAC.chrome, border: `2px solid ${MAC.border}`,
        width: 320, boxShadow: "4px 4px 0 rgba(0,0,0,0.3)", textAlign: "center",
      }}>
        <div style={{
          height: 20, borderBottom: `1px solid ${MAC.border}`,
          backgroundImage: `repeating-linear-gradient(
            transparent 0px, transparent 1px,
            ${MAC.titleStripes} 1px, ${MAC.titleStripes} 2px,
            transparent 2px, transparent 3px
          )`,
        }} />
        <div style={{ padding: "24px 20px" }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>◉</div>
          <div style={{ fontSize: 16, fontWeight: "bold", marginBottom: 4 }}>Chaos Dimension</div>
          <div style={{ fontSize: 11, color: MAC.textDim, marginBottom: 12 }}>
            Summer '26 Mission Control<br />
            Kanban × Agent Orchestration<br />
            v0.3
          </div>
          <div style={{ fontSize: 10, color: MAC.textDim, marginBottom: 12 }}>
            "Build the tool, then use the tool to build everything else."
          </div>
          <div style={{ fontSize: 10, color: MAC.textDim, marginBottom: 16 }}>
            <Attribution
              textStyle={{ color: MAC.textDim }}
              linkStyle={{ color: MAC.highlight, textDecoration: 'underline' }}
            />
          </div>
          <button className="mac-btn mac-btn-primary" onClick={onClose} style={{ minWidth: 80 }}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
