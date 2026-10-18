export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Resolve against the page URL rather than the origin root, so requests stay
  // under the Home Assistant ingress sub-path when served from there.
  const res = await fetch(path.replace(/^\//, ""), {
    credentials: "include",
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    let data: any = null;
    try {
      data = await res.json();
    } catch {}
    throw new ApiError(res.status, data?.message ?? `HTTP ${res.status}`, data);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  return undefined as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(p: string) => request<T>(p, { method: "DELETE" }),
  upload: <T>(p: string, form: FormData) => request<T>(p, { method: "POST", body: form }),
};
