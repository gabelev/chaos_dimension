import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../themes';
import { api } from '../lib/api';

export default function Login() {
  const { theme } = useTheme();
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
    } catch (err) {
      setError(err?.message || 'Invalid password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...theme.desktop, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          background: theme.chrome,
          border: theme.windowBorder,
          width: 340,
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
            {theme.id === 'terminal' ? '── Sign in to Chaos Dimension ──' : 'Sign in to Chaos Dimension'}
          </span>
        </div>
        <form onSubmit={submit} style={{ padding: 20, background: theme.windowBg }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 'bold', color: theme.textDim }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            style={theme.input}
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
