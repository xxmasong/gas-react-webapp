import React, { useCallback, useState } from 'react';
import type { Role } from '@shared/types';
import { useToast } from '../../providers';
import { cleanError } from '../../lib/errors';
import { ROLE_LABEL, ROLE_VALUES } from '../../config';
import { Spinner } from '../atoms';

type Props = {
  onRegister: (data: { username: string; password: string; role: Role }) => Promise<void>;
};

export const UserForm: React.FC<Props> = ({ onRegister }) => {
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('inventory_staff');
  const [busy, setBusy] = useState(false);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
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
  }, [username, password, role, onRegister, toast]);

  const onUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>)  => setUsername(e.target.value), []);
  const onPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>)  => setPassword(e.target.value), []);
  const onRoleChange     = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => setRole(e.target.value as Role), []);

  return (
    <form className="cat-form" onSubmit={onSubmit}>
      <input
        placeholder="Username"
        value={username}
        onChange={onUsernameChange}
        autoCapitalize="none"
        spellCheck={false}
      />
      <input
        placeholder="Password (min 10, mixed)"
        type="password"
        value={password}
        onChange={onPasswordChange}
      />
      <select value={role} onChange={onRoleChange}>
        {ROLE_VALUES.map((r) => (
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
