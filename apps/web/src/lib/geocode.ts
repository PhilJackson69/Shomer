import { apiFetch } from '@/lib/apiFetch';

export async function geocodePlace(q: string, token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
  if (!token) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?limit=1&access_token=${token}`;
  try {
    const r = await apiFetch(url); if (!r.ok) return null;
    const j = await r.json(); const f = j.features?.[0];
    if (!f?.center) return null;
    return { lng: f.center[0], lat: f.center[1] } as { lng: number; lat: number };
  } catch { return null; }
}


