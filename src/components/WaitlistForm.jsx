import { useState } from 'react';
import { useTheme } from '../themes';

export default function WaitlistForm() {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [hp, setHp] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, note, hp }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message || 'Could not join the waitlist.');
      } else {
        setDone(true);
      }
    } catch (err) {
      setError(err?.message || 'Network error.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={{ background: theme.chrome, border: theme.windowBorder, padding: 16, color: theme.text, fontSize: 13 }}>
        Thanks — we'll be in touch when there's an invite for you.
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{
      background: theme.chrome,
      border: theme.windowBorder,
      padding: 16,
      color: theme.text,
      fontFamily: theme.FONT,
      borderRadius: theme.window?.borderRadius || 0,
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Join the waitlist</div>
      <div style={{ fontSize: 12, color: theme.textDim, marginBottom: 12 }}>
        Tell us a bit about what you'd use it for — we send invites in small batches.
      </div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', marginBottom: 4, color: theme.textDim }}>Email</label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        style={theme.input}
      />
      <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', margin: '10px 0 4px', color: theme.textDim }}>Name (optional)</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        style={theme.input}
      />
      <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', margin: '10px 0 4px', color: theme.textDim }}>
        What would you use it for? (optional)
      </label>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={theme.input}
      />
      {/* Honeypot — real users never fill this; CSS hides it from view. */}
      <input
        type="text"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-10000px', height: 0, width: 0, opacity: 0 }}
      />
      {error && <div style={{ color: '#990000', marginTop: 8, fontSize: 11 }}>{error}</div>}
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <button type="submit" disabled={busy} className="mac-btn mac-btn-primary">
          {busy ? 'Sending…' : 'Notify me'}
        </button>
      </div>
    </form>
  );
}
