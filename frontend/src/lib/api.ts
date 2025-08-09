export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function extractErrorMessage(err: any, status: number): string {
  if (!err) return `Request failed: ${status}`;
  if (typeof err === 'string') return err;
  if (typeof err.error === 'string') return err.error;
  if (typeof err.message === 'string') return err.message;
  if (err.error && typeof err.error === 'object') {
    const e = err.error;
    // Zod flatten shape: { formErrors: string[], fieldErrors: Record<string, string[]> }
    const parts: string[] = [];
    if (Array.isArray(e.formErrors) && e.formErrors.length) {
      parts.push(...e.formErrors);
    }
    if (e.fieldErrors && typeof e.fieldErrors === 'object') {
      for (const [field, messages] of Object.entries(e.fieldErrors)) {
        if (Array.isArray(messages) && messages.length) {
          parts.push(`${field}: ${messages.join(', ')}`);
        }
      }
    }
    if (parts.length) return parts.join(' | ');
  }
  // Fallback to JSON string
  try {
    return JSON.stringify(err);
  } catch {
    return `Request failed: ${status}`;
  }
}

export async function api(path: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...authHeaders(),
  } as Record<string, string>;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  // Read once as text so we can handle empty and non-JSON bodies safely
  const text = await res.text().catch(() => '');
  let data: any = null;
  if (text && text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null; // Non-JSON body
    }
  }
  if (!res.ok) {
    const message = extractErrorMessage(data, res.status);
    throw new Error(message);
  }
  if (res.status === 204 || data == null) {
    return {} as any;
  }
  return data;
}
