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

// Raw fetch with auth headers. Does not force Content-Type; useful for FormData or binary responses
export async function fetchAuthed(path: string, options: RequestInit = {}) {
  const providedHeaders = (options.headers || {}) as Record<string, string>;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': providedHeaders['Content-Type'] || providedHeaders['content-type'] || 'application/json' }),
    ...providedHeaders,
    ...authHeaders(),
  } as Record<string, string>;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return res;
}

// Download helper for CSV or other files
export async function download(path: string, filename: string) {
  const res = await fetchAuthed(path, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = `Request failed: ${res.status}`;
    try { if (text) { const j = JSON.parse(text); message = extractErrorMessage(j, res.status); } } catch {}
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Convenience helpers for DELETE requests that expect 204 No Content
export async function apiDelete(path: string) {
  const headers = { ...authHeaders() } as Record<string, string>;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let data: any = null;
    if (text) { try { data = JSON.parse(text); } catch {} }
    const message = extractErrorMessage(data, res.status);
    throw new Error(message);
  }
  return {} as any;
}

// Receipt management helpers
export async function updateExpenseReceipt(expenseId: string, file: File) {
  const formData = new FormData();
  formData.append('receipt', file);
  
  const res = await fetchAuthed(`/expenses/${expenseId}/receipt`, {
    method: 'PUT',
    body: formData,
  });
  
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let data: any = null;
    if (text) { try { data = JSON.parse(text); } catch {} }
    const message = extractErrorMessage(data, res.status);
    throw new Error(message);
  }
  
  return await res.json();
}

export async function deleteExpenseReceipt(expenseId: string) {
  return await apiDelete(`/expenses/${expenseId}/receipt`);
}
