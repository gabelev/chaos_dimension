import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MAC, GLOBAL_CSS } from '../styles/mac';
import { api } from '../lib/api';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      nav('/app');
    } catch {
      setError('Invalid password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...MAC.desktop, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ ...MAC.window, width: 320 }}>
        <div style={MAC.titleBar}>
          <span style={{ background: MAC.chrome, padding: '0 10px' }}>Sign in to Chaos Dimension</span>
        </div>
        <form onSubmit={submit} style={{ padding: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 'bold', color: MAC.textDim }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            style={MAC.input}
          />
          {error && (
            <div style={{ color: '#990000', marginTop: 8, fontSize: 11 }}>{error}</div>
          )}
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button type="submit" disabled={busy} className="mac-btn mac-btn-primary">
              {busy ? 'Signing in...' : 'OK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
