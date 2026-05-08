const CIRCLE_API_ORIGIN = "https://api.circle.com";
const CIRCLE_STABLECOIN_PATH_PREFIX = "/v1/stablecoinKits";

export const BROWSER_SWAP_PROXY_KIT_KEY = "KIT_KEY:browser:proxy";

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getRequestHeaders(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.headers) return new Headers(init.headers);
  if (typeof input === "object" && "headers" in input) {
    return new Headers(input.headers);
  }
  return new Headers();
}

function buildProxyUrl(url: URL) {
  const upstreamPath = url.pathname.slice(CIRCLE_STABLECOIN_PATH_PREFIX.length);
  return `/api/circle/stablecoin-kits${upstreamPath}${url.search}`;
}

export async function withCircleStablecoinProxy<T>(operation: () => Promise<T>) {
  if (typeof window === "undefined") {
    return operation();
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(getRequestUrl(input), window.location.origin);

    if (
      requestUrl.origin === CIRCLE_API_ORIGIN &&
      requestUrl.pathname.startsWith(CIRCLE_STABLECOIN_PATH_PREFIX)
    ) {
      const headers = getRequestHeaders(input, init);
      headers.delete("authorization");
      headers.delete("Authorization");

      return originalFetch(buildProxyUrl(requestUrl), {
        ...init,
        headers,
      });
    }

    return originalFetch(input, init);
  };

  try {
    return await operation();
  } finally {
    window.fetch = originalFetch;
  }
}
