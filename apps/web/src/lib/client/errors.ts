import { apiFetch } from "@/lib/apiFetch";
// Client-side error handling for rate limits and CSRF

export async function safeAction<T>(fn: () => Promise<Response>): Promise<T | null> {
  try {
    const r = await fn();
    
    if (r.status === 429) {
      // Rate limited - could show toast notification
      console.warn("Too many actions. Try again in a moment.");
      return null;
    }
    
    if (r.status === 403) {
      // CSRF token missing or invalid
      console.error("Your session is missing a CSRF token. Refresh the page.");
      return null;
    }
    
    if (!r.ok) {
      // Other error
      console.error("Request failed with status:", r.status);
      return null;
    }
    
    return await r.json();
  } catch (error) {
    console.error("Request failed:", error);
    return null;
  }
}

// Helper for specific incident actions
export async function ackIncident(incidentId: string): Promise<boolean> {
  const result = await safeAction(() => 
    apiFetch(`/api/incidents/${incidentId}/ack`, { method: 'POST', credentials: "include" })
  );
  return result !== null;
}

export async function closeIncident(incidentId: string): Promise<boolean> {
  const result = await safeAction(() => 
    apiFetch(`/api/incidents/${incidentId}/close`, { method: 'POST', credentials: "include" })
  );
  return result !== null;
}

export async function addNote(incidentId: string, body: string): Promise<boolean> {
  const result = await safeAction(() => 
    apiFetch(`/api/incidents/${incidentId}/notes`, { method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    })
  );
  return result !== null;
}
