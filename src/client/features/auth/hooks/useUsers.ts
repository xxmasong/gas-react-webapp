import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role, User } from '@shared/types';
import { server } from '../../../lib/server';

const usersKey = ['users'] as const;

export const useUsers = () => {
  const qc = useQueryClient();

  const { data: users = [], isLoading: loading, error } = useQuery({
    queryKey: usersKey,
    queryFn: () => server.listUsers(),
  });

  // Write the server's returned user straight into the cache — no refetch.
  const upsert = useCallback(
    (updated: User) =>
      qc.setQueryData<User[]>(usersKey, (prev = []) =>
        prev.map((u) => (u.id === updated.id ? updated : u)),
      ),
    [qc],
  );

  const register = useMutation({
    mutationFn: (p: { username: string; password: string; role: Role }) =>
      server.registerUser(p.username, p.password, p.role),
    onSuccess: (created) =>
      qc.setQueryData<User[]>(usersKey, (prev = []) => [...prev, created]),
  });

  // setActive / setRole apply the change to the cache OPTIMISTICALLY (instant
  // UI), then reconcile with the server's response. On error, roll back.
  const setActive = useMutation({
    mutationFn: (p: { id: string; active: boolean }) => server.setUserActive(p.id, p.active),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: usersKey });
      const prev = qc.getQueryData<User[]>(usersKey);
      qc.setQueryData<User[]>(usersKey, (cur = []) =>
        cur.map((u) => (u.id === p.id ? { ...u, active: p.active } : u)),
      );
      return { prev };
    },
    onError: (_e, _p, ctx) => { if (ctx?.prev) qc.setQueryData(usersKey, ctx.prev); },
    onSuccess: upsert,
  });

  const setRole = useMutation({
    mutationFn: (p: { id: string; role: Role }) => server.setUserRole(p.id, p.role),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: usersKey });
      const prev = qc.getQueryData<User[]>(usersKey);
      qc.setQueryData<User[]>(usersKey, (cur = []) =>
        cur.map((u) => (u.id === p.id ? { ...u, role: p.role } : u)),
      );
      return { prev };
    },
    onError: (_e, _p, ctx) => { if (ctx?.prev) qc.setQueryData(usersKey, ctx.prev); },
    onSuccess: upsert,
  });

  const remove = useMutation({
    mutationFn: (id: string) => server.deleteUserAccount(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: usersKey });
      const prev = qc.getQueryData<User[]>(usersKey);
      qc.setQueryData<User[]>(usersKey, (cur = []) => cur.filter((u) => u.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(usersKey, ctx.prev); },
  });

  return useMemo(() => ({
    users: users as User[],
    loading,
    error: error ? String(error) : null,
    register: register.mutateAsync,
    setActive: setActive.mutateAsync,
    setRole: setRole.mutateAsync,
    remove: remove.mutateAsync,
  }), [users, loading, error, register.mutateAsync, setActive.mutateAsync, setRole.mutateAsync, remove.mutateAsync]);
};
