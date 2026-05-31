import React from 'react';
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

  const guarded = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(cleanError(e));
    }
  };

  return (
    <AppShell>
      <h3 className="section-title">Add a user</h3>
      <UserForm onRegister={async (data) => { await register(data); }} />

      <h3 className="section-title">Accounts</h3>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <UserTable
          users={users}
          selfId={me?.id ?? ''}
          onSetRole={(id, role: Role) =>
            guarded(() => setRole({ id, role }), `Updated role.`)
          }
          onSetActive={(id, active) =>
            guarded(
              () => setActive({ id, active }),
              active ? `Account enabled.` : `Account disabled.`,
            )
          }
          onDelete={(id) => guarded(() => remove(id), `Account deleted.`)}
        />
      )}
    </AppShell>
  );
};
