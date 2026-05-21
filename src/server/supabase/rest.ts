type QueryValue = string | number | boolean | null | undefined;

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE;

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function getRestUrl(path: string) {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is not configured.");
  }
  return `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path.replace(/^\//, "")}`;
}

function getHeaders(extra: HeadersInit = {}) {
  if (!SUPABASE_KEY) {
    throw new Error("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(getRestUrl(path), {
    ...init,
    cache: "no-store",
    headers: getHeaders(init.headers),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${response.status}: ${body || response.statusText}`);
  }

  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

function appendFilters(params: URLSearchParams, filters?: Record<string, QueryValue>) {
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, `eq.${String(value)}`);
  }
}

export async function selectRows<T>(
  table: string,
  options: {
    filters?: Record<string, QueryValue>;
    limit?: number;
    order?: string;
    select?: string;
  } = {},
) {
  const params = new URLSearchParams();
  params.set("select", options.select ?? "*");
  appendFilters(params, options.filters);
  if (options.order) params.set("order", options.order);
  if (options.limit) params.set("limit", String(options.limit));

  return supabaseRequest<T[]>(`${table}?${params.toString()}`);
}

export async function insertRow<T>(table: string, row: Record<string, unknown>) {
  const rows = await supabaseRequest<T[]>(table, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });

  return rows[0] ?? null;
}

export async function updateRows<T>(
  table: string,
  filters: Record<string, QueryValue>,
  patch: Record<string, unknown>,
) {
  const params = new URLSearchParams();
  appendFilters(params, filters);

  return supabaseRequest<T[]>(`${table}?${params.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
}
