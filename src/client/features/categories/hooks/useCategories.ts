import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SkuCategory, NewSkuCategory } from '@shared/types';
import { server } from '../../../lib/server';
import { queryKeys } from '../../../lib/queryKeys';

export const useCategories = () => {
  const qc = useQueryClient();

  const { data: categories = [], isLoading: loading, error } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => server.getCategories(),
  });

  const addMutation = useMutation({
    mutationFn: (cat: NewSkuCategory) => server.addCategory(cat),
    onSuccess: (created) => {
      qc.setQueryData<SkuCategory[]>(queryKeys.categories, (prev = []) =>
        [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder),
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (cat: SkuCategory) => server.updateCategory(cat),
    onSuccess: (updated) => {
      qc.setQueryData<SkuCategory[]>(queryKeys.categories, (prev = []) =>
        prev.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => a.sortOrder - b.sortOrder),
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => server.deleteCategory(id),
    onSuccess: (_, id) => {
      qc.setQueryData<SkuCategory[]>(queryKeys.categories, (prev = []) =>
        prev.filter((c) => c.id !== id),
      );
    },
  });

  const mutationError = useMemo(
    () => (addMutation.error || updateMutation.error || removeMutation.error)
      ? String(addMutation.error ?? updateMutation.error ?? removeMutation.error)
      : null,
    [addMutation.error, updateMutation.error, removeMutation.error],
  );

  return useMemo(() => ({
    categories,
    loading,
    error: error ? String(error) : null,
    add: addMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    mutationError,
  }), [categories, loading, error, addMutation.mutateAsync, updateMutation.mutateAsync, removeMutation.mutateAsync, mutationError]);
};
