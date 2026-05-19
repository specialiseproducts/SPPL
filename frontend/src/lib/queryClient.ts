import { QueryClient } from '@tanstack/react-query';
import { queryDefaults } from '../hooks/queryDefaults';

/** Single app-wide instance — must not be created inside components. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...queryDefaults.list,
      retry: 1,
    },
  },
});
