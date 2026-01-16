import { QueryClient, QueryFunction, dehydrate, hydrate } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const REQUEST_TIMEOUT_MS = 15000;
const QUERY_CACHE_KEY = "wc_query_cache_v1";
const QUERY_CACHE_MAX_AGE_MS = 60 * 60 * 1000;

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetchWithTimeout(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetchWithTimeout(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export function hydrateQueryCache() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(QUERY_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { timestamp?: number; state?: unknown };
    if (!parsed?.timestamp || !parsed?.state) return;
    if (Date.now() - parsed.timestamp > QUERY_CACHE_MAX_AGE_MS) {
      window.localStorage.removeItem(QUERY_CACHE_KEY);
      return;
    }
    hydrate(queryClient, parsed.state);
  } catch {
    // ignore cache corruption
  }
}

export function subscribeToQueryCache() {
  if (typeof window === "undefined") return () => undefined;
  let timeoutId: number | null = null;
  return queryClient.getQueryCache().subscribe(() => {
    if (timeoutId) return;
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      try {
        const state = dehydrate(queryClient, {
          shouldDehydrateQuery: (query) => {
            const [rootKey] = query.queryKey as (string | number)[];
            if (rootKey === "composite-session-messages") return false;
            return query.state.status === "success";
          },
        });
        window.localStorage.setItem(
          QUERY_CACHE_KEY,
          JSON.stringify({ timestamp: Date.now(), state })
        );
      } catch {
        // ignore storage errors
      }
    }, 1000);
  });
}
