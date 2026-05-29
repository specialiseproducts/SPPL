import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { queryDefaults } from '../hooks/queryDefaults';
import { reportError } from './observability/errorReporter';

/** Single app-wide instance — must not be created inside components. */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      reportError(error, {
        source: 'query',
        extra: { queryKey: query.queryKey },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      reportError(error, { source: 'query', extra: { kind: 'mutation' } });
    },
  }),
  defaultOptions: {
    queries: {
      ...queryDefaults.list,
      retry: 1,
    },
  },
});
