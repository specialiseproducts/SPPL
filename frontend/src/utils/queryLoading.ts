import type { UseQueryResult } from '@tanstack/react-query';

/** Cold load only — false when cached data is shown (including background refetch). */
export function isQueryColdLoading(query: Pick<UseQueryResult<unknown>, 'isLoading'>): boolean {
  return query.isLoading;
}
