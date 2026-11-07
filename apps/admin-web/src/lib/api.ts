"use client";

const API_BASE =
  process.env["NEXT_PUBLIC_API_URL"] || "http://localhost:4000/api/v1";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    phone: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    isSuperAdmin?: boolean;
  };
}

export const STORAGE_KEY = "asn_admin_session";

export function getSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ success: boolean; data?: T; error?: { message: string } }> {
  const session = getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (session?.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`;
  }

  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: {
          message:
            json?.error?.message ||
            json?.message ||
            `HTTP ${res.status}: ${res.statusText}`,
        },
      };
    }
    return {
      success: true,
      data: json.data !== undefined ? json.data : json,
    };
  } catch (err: any) {
    return {
      success: false,
      error: {
        message: err?.message || "Network error. Please check API server.",
      },
    };
  }
}
