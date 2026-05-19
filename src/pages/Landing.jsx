import { Link } from 'react-router-dom';
import App from './App';
import { MAC } from '../styles/mac';

export default function Landing() {
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'fixed',
          top: 4,
          right: 12,
          zIndex: 100,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          fontSize: 11,
          fontWeight: 'bold',
          color: '#fff',
          textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
        }}
      >
        <a
          href="https://github.com/gabelev/chaos_dimension"
          target="_blank"
          rel="noreferrer"
          style={{ color: '#fff', textDecoration: 'underline' }}
        >
          GitHub
        </a>
        <Link to="/about" style={{ color: '#fff', textDecoration: 'underline' }}>
          About
        </Link>
        <Link to="/login" style={{ color: '#fff', textDecoration: 'underline' }}>
          Login
        </Link>
      </div>
      <App mode="demo" />
    </div>
  );
}
