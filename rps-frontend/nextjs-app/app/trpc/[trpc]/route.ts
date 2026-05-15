import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/lib/trpc/router";

export const runtime = "nodejs";

const handler = (request: Request) =>
  fetchRequestHandler({
    endpoint: "/trpc",
    req: request,
    router: appRouter,
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };
