import React, { useCallback, useState } from 'react';
import { useAuth, useToast } from '../../providers';
import { cleanError } from '../../lib/errors';
import { Spinner } from '../atoms';
import { ThemeToggle } from '../molecules';

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      toast.error(cleanError(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  }, [username, password, login, toast]);

  const onUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value), []);
  const onPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value), []);
  const toggleShowPw = useCallback(() => setShowPw((s) => !s), []);

  return (
    <div className="login-screen">
      <ThemeToggle />

      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">📦</div>
          <h1>Inventory</h1>
          <p className="muted">Sign in to continue</p>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            <span>Username</span>
            <input
              value={username}
              onChange={onUsernameChange}
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
                onChange={onPasswordChange}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={toggleShowPw}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          <button type="submit" className="primary login-submit" disabled={busy}>
            {busy && <Spinner size={16} />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="login-footnote muted">
          No account? Ask an administrator to create one for you.
        </p>
      </div>
    </div>
  );
};
