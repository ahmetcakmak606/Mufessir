'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchFilters } from '@/lib/tafseer';

export function useFiltersQuery() {
  return useQuery({
    queryKey: ['filters'],
    queryFn: fetchFilters,
    staleTime: 5 * 60_000,
  });
}
