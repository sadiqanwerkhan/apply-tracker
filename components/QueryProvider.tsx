"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

// One QueryClient per browser session. Created in state so it's stable across
// re-renders but not shared between requests on the server.
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // The dashboard data only changes when the user scans, so we don't
            // want React Query refetching on every window focus.
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
