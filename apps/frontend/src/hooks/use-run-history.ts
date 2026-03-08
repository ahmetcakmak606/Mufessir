'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchRunDetail, fetchRunHistory, updateRunMetadata } from '@/lib/tafseer';

export function useRunHistoryQuery(cursor?: string, limit = 20) {
  return useQuery({
    queryKey: ['tafseer-runs', cursor || null, limit],
    queryFn: () => fetchRunHistory({ cursor, limit }),
    staleTime: 20_000,
  });
}

export function useInfiniteRunHistoryQuery(limit = 20) {
  return useInfiniteQuery({
    queryKey: ['tafseer-runs-infinite', limit],
    queryFn: ({ pageParam }) => fetchRunHistory({ cursor: pageParam as string | undefined, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 20_000,
  });
}

export function useRunDetailQuery(runId?: string) {
  return useQuery({
    queryKey: ['tafseer-run-detail', runId],
    queryFn: () => fetchRunDetail(runId || ''),
    enabled: Boolean(runId),
    staleTime: 20_000,
  });
}

export function useUpdateRunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      runId,
      payload,
    }: {
      runId: string;
      payload: { title?: string | null; starred?: boolean; notes?: string | null };
    }) => updateRunMetadata(runId, payload),
    onSuccess: (_summary, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tafseer-runs'] });
      queryClient.invalidateQueries({ queryKey: ['tafseer-runs-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['tafseer-run-detail', variables.runId] });
    },
  });
}
