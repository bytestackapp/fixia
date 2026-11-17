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

export const useBookings = () => useQuery({ queryKey: ['bookings'], queryFn: () => call('bookings.list') });
export const useCounts = () => useQuery({ queryKey: ['counts'], queryFn: () => call('counts'), refetchInterval: 30_000, staleTime: 15_000 });
export const useProfile = () => useQuery({ queryKey: ['profile'], queryFn: () => call('profile.get') });

// run an action, then refresh whatever it changed
export function useAct(action, { invalidate = [], onSuccess } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => call(action, payload),
    onSuccess: (d, v) => { invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); onSuccess?.(d, v); },
  });
}
