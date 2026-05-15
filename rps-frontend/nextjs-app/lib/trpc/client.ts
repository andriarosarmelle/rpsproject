import { createTRPCProxyClient, httpLink, TRPCClientError } from "@trpc/client";
import { appFetch, getAppUrl } from "@/lib/api";
import type { AppRouter } from "@/lib/trpc/router";

let trpcClient: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null = null;

export function getTrpcClient() {
  if (!trpcClient) {
    trpcClient = createTRPCProxyClient<AppRouter>({
      links: [
        httpLink({
          url: getAppUrl("/trpc"),
          // Increase timeout for slow connections like Starlink (default is 10s)
          fetch: (url, options) => {
            return appFetch(String(url), {
              ...options,
              // 2 minutes timeout for large imports
              signal: AbortSignal.timeout(120000),
            });
          },
        }),
      ],
    });
  }

  return trpcClient;
}

export function formatTrpcError(error: unknown): string {
  if (error instanceof TRPCClientError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Une erreur inattendue s'est produite.";
}
