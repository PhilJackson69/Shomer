import { apiFetch } from "@/lib/apiFetch";
// Client-side CSRF token management

let CSRF: string | null = null;

export async function getCsrf(): Promise<string> {
  if (CSRF) return CSRF;
  
  const res = await apiFetch("/api/csrf", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to get CSRF token");
  }
  
  const { token } = await res.json();
  CSRF = token;
  return CSRF;
}

export async function postJson(url: string, body: unknown): Promise<Response> {
  const token = await getCsrf();
  return apiFetch(url, { method: 'POST',
    headers: { 
      "Content-Type": "application/json", 
      "x-csrf-token": token 
    },
    body: JSON.stringify(body),
  });
}

export async function putJson(url: string, body: unknown): Promise<Response> {
  const token = await getCsrf();
  return apiFetch(url, { method: 'PUT',
    headers: { 
      "Content-Type": "application/json", 
      "x-csrf-token": token 
    },
    body: JSON.stringify(body),
  });
}

export async function deleteJson(url: string): Promise<Response> {
  const token = await getCsrf();
  return apiFetch(url, { method: 'DELETE',
    headers: { 
      "x-csrf-token": token 
    },
  });
}
