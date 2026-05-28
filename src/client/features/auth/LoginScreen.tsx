import { useState } from 'react';
import { useAuth } from '../../providers';
import { useTheme } from '../../providers';

export function LoginScreen() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err).replace(/^Error:\s*/, ''));
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <button
        className="ghost login-theme"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>

      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">📦</div>
          <h1>Inventory</h1>
          <p className="muted">Sign in to continue</p>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          {error && <div className="error">{error}</div>}

          <label>
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>

          <label>
            <span>Password</span>
            <div className="pw-field">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          <button type="submit" className="primary login-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="login-footnote muted">
          No account? Ask an administrator to create one for you.
        </p>
      </div>
    </div>
  );
}
