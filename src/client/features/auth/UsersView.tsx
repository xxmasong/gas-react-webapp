import { useState } from 'react';
import type { Role } from '@shared/types';
import { useAuth, useToast } from '../../providers';
import { useUsers } from './hooks/useUsers';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  inventory_staff: 'Inventory staff',
};

const ROLES: Role[] = ['inventory_staff', 'supervisor', 'admin'];

export function UsersView() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { users, loading, error, register, setActive, setRole, remove } = useUsers();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRoleSel] = useState<Role>('inventory_staff');
  const [busy, setBusy] = useState(false);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    if (username.trim().length < 3 || password.length < 10) {
      toast.error('Username ≥ 3 chars and password ≥ 10 chars required.');
      return;
    }
    setBusy(true);
    try {
      await register({ username: username.trim(), password, role });
      toast.success(`Created ${role.replace('_', ' ')} "${username.trim()}".`);
      setUsername('');
      setPassword('');
      setRoleSel('inventory_staff');
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e).replace(/^Error:\s*/, ''));
    } finally {
      setBusy(false);
    }
  }

  async function guarded(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e).replace(/^Error:\s*/, ''));
    }
  }

  return (
    <>
      {error && <div className="error">{error}</div>}

      <h3 className="section-title">Add a user</h3>
      <form className="cat-form" onSubmit={onRegister}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          spellCheck={false}
        />
        <input
          placeholder="Password (min 10, mixed)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <select value={role} onChange={(e) => setRoleSel(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Adding…' : 'Add user'}
        </button>
      </form>

      <h3 className="section-title">Accounts</h3>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === me?.id;
              return (
                <tr key={u.id}>
                  <td>{u.username}{isSelf && <span className="muted"> (you)</span>}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) =>
                        guarded(() => setRole({ id: u.id, role: e.target.value as Role }),
                          `Updated ${u.username}'s role.`)
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.active
                      ? <span className="kyte-badge ok">Active</span>
                      : <span className="kyte-badge bad">Disabled</span>}
                  </td>
                  <td className="actions">
                    {!isSelf && (
                      <>
                        <button
                          onClick={() =>
                            guarded(() => setActive({ id: u.id, active: !u.active }),
                              u.active ? `Disabled ${u.username}.` : `Enabled ${u.username}.`)
                          }
                        >
                          {u.active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          className="del"
                          onClick={() => {
                            if (confirm(`Delete account "${u.username}"? This cannot be undone.`)) {
                              guarded(() => remove(u.id), `Deleted ${u.username}.`);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
