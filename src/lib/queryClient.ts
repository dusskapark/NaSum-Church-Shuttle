import { MutationCache, QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      if (mutation.meta?.skipAutoInvalidate === true) return;

      setTimeout(() => {
        queryClient.invalidateQueries({ type: 'active' }).catch(() => {});
      }, 0);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
