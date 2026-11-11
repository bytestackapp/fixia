import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { call } from './api.js';

export const useHome = (loc) => useQuery({ queryKey: ['home', loc], queryFn: () => call('home', loc), staleTime: 5 * 60_000 });
export const useProviders = (params) => useQuery({ queryKey: ['providers', params], queryFn: () => call('providers.list', params), placeholderData: keepPreviousData });
export const useProvider = (id) => useQuery({ queryKey: ['provider', id], queryFn: () => call('providers.get', { id }) });
export const useSaved = () => useQuery({ queryKey: ['saved'], queryFn: () => call('saved.list') });

export function useToggleSave(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (saved) => call('saved.set', { providerId: id, saved }),
    onMutate: (saved) => qc.setQueryData(['provider', id], (d) => (d ? { ...d, saved } : d)),   // instant feedback
    onError: (_e, saved) => qc.setQueryData(['provider', id], (d) => (d ? { ...d, saved: !saved } : d)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  });
}
