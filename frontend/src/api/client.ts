export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Serialized as JSON. */
  body?: unknown;
  /** JWT returned by POST /login. Sent as "Authorization: Bearer ...". */
  token?: string | null;
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
}

/** JSON fetch helper: attaches the token, parses the response, throws ApiError for non-2xx. */
export async function apiFetch<T = void>(
  url: string,
  options: ApiOptions = {},
): Promise<T> {
  const { method = "GET", body, token, timeoutMs = 15_000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new ApiError(
      0,
      aborted
        ? "Request timed out"
        : "Network error: is the backend reachable?",
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  const data: unknown = text ? safeJson(text) : undefined;

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(response.status, message, data);
  }
  return data as T;
}

// api/client.ts

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
