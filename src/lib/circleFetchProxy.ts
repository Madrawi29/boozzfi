const CIRCLE_PROXY_HOSTS = new Set([
  "gateway-api.circle.com",
  "gateway-api-testnet.circle.com",
  "iris-api.circle.com",
  "iris-api-sandbox.circle.com",
]);

let installed = false;

function shouldProxy(input: RequestInfo | URL) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  try {
    const target = new URL(url);
    return CIRCLE_PROXY_HOSTS.has(target.hostname);
  } catch {
    return false;
  }
}

function toProxyInput(input: RequestInfo | URL) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  return `/api/circle/proxy?url=${encodeURIComponent(url)}`;
}

export function installCircleFetchProxy() {
  if (installed || typeof window === "undefined") return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (!shouldProxy(input)) return originalFetch(input, init);

    if (input instanceof Request) {
      return originalFetch(toProxyInput(input), {
        body: input.body,
        headers: input.headers,
        method: input.method,
        ...init,
      });
    }

    return originalFetch(toProxyInput(input), init);
  };
  installed = true;
}
