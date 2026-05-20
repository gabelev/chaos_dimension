import { Link } from 'react-router-dom';
import { MAC, GLOBAL_CSS } from '../styles/mac';
import Attribution from '../components/Attribution';

export default function About() {
  return (
    <div style={{ ...MAC.desktop, padding: 24, overflow: 'auto' }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ ...MAC.window, maxWidth: 640, margin: '40px auto' }}>
        <div style={MAC.titleBar}>
          <span style={{ background: MAC.chrome, padding: '0 10px' }}>About Chaos Dimension</span>
        </div>
        <div style={{ padding: 20, background: '#fff', lineHeight: 1.6 }}>
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
              style={MAC.link}
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
              style={MAC.link}
            >
              github.com/gabelev/chaos_dimension
            </a>
          </p>
          <p style={{ marginBottom: 12 }}>
            <Attribution linkStyle={MAC.link} />
          </p>
          <p style={{ marginTop: 20 }}>
            <Link to="/" style={MAC.link}>← Back</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
