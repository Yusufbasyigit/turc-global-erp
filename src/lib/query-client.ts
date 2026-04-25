import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
