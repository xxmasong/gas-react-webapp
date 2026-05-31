import React, { useCallback } from 'react';
import type { Role } from '@shared/types';
import { useAuth, useToast } from '../../providers';
import { cleanError } from '../../lib/errors';
import { useUsers } from '../../features/auth/hooks/useUsers';
import { UserForm, UserTable } from '../organisms';
import { AppShell } from '../templates';

export const UsersPage: React.FC = () => {
  const { user: me } = useAuth();
  const toast = useToast();
  const { users, loading, error, register, setActive, setRole, remove } = useUsers();

  if (error) toast.error(cleanError(error));

  const guarded = useCallback(async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(cleanError(e));
    }
  }, [toast]);

  const onRegister = useCallback(
    async (data: { username: string; password: string; role: Role }) => { await register(data); },
    [register],
  );

  const onSetRole = useCallback(
    (id: string, role: Role) => guarded(() => setRole({ id, role }), 'Updated role.'),
    [guarded, setRole],
  );

  const onSetActive = useCallback(
    (id: string, active: boolean) =>
      guarded(() => setActive({ id, active }), active ? 'Account enabled.' : 'Account disabled.'),
    [guarded, setActive],
  );

  const onDelete = useCallback(
    (id: string) => guarded(() => remove(id), 'Account deleted.'),
    [guarded, remove],
  );

  return (
    <AppShell>
      <h3 className="section-title">Add a user</h3>
      <UserForm onRegister={onRegister} />

      <h3 className="section-title">Accounts</h3>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <UserTable
          users={users}
          selfId={me?.id ?? ''}
          onSetRole={onSetRole}
          onSetActive={onSetActive}
          onDelete={onDelete}
        />
      )}
    </AppShell>
  );
};
