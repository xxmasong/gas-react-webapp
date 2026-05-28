import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role, User } from '@shared/types';
import { server } from '../../../lib/server';

const usersKey = ['users'] as const;

export function useUsers() {
  const qc = useQueryClient();

  const { data: users = [], isLoading: loading, error } = useQuery({
    queryKey: usersKey,
    queryFn: () => server.listUsers(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: usersKey });

  const register = useMutation({
    mutationFn: (p: { username: string; password: string; role: Role }) =>
      server.registerUser(p.username, p.password, p.role),
    onSuccess: invalidate,
  });

  const setActive = useMutation({
    mutationFn: (p: { id: string; active: boolean }) => server.setUserActive(p.id, p.active),
    onSuccess: invalidate,
  });

  const setRole = useMutation({
    mutationFn: (p: { id: string; role: Role }) => server.setUserRole(p.id, p.role),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => server.deleteUserAccount(id),
    onSuccess: invalidate,
  });

  return {
    users: users as User[],
    loading,
    error: error ? String(error) : null,
    register: register.mutateAsync,
    setActive: setActive.mutateAsync,
    setRole: setRole.mutateAsync,
    remove: remove.mutateAsync,
  };
}
