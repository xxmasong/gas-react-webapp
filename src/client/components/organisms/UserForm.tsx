import React, { useState } from 'react';
import type { Role } from '@shared/types';
import { useToast } from '../../providers';
import { cleanError } from '../../lib/errors';
import { Spinner } from '../atoms';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  inventory_staff: 'Inventory staff',
};

const ROLES: Role[] = ['inventory_staff', 'supervisor', 'admin'];

type Props = {
  onRegister: (data: { username: string; password: string; role: Role }) => Promise<void>;
};

export const UserForm: React.FC<Props> = ({ onRegister }) => {
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('inventory_staff');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length < 3 || password.length < 10) {
      toast.error('Username ≥ 3 chars and password ≥ 10 chars required.');
      return;
    }
    setBusy(true);
    try {
      await onRegister({ username: username.trim(), password, role });
      toast.success(`Created ${role.replace('_', ' ')} "${username.trim()}".`);
      setUsername('');
      setPassword('');
      setRole('inventory_staff');
    } catch (e) {
      toast.error(cleanError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="cat-form" onSubmit={onSubmit}>
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
      <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
        ))}
      </select>
      <button type="submit" className="primary" disabled={busy}>
        {busy && <Spinner size={14} />}
        {busy ? 'Adding…' : 'Add user'}
      </button>
    </form>
  );
};
