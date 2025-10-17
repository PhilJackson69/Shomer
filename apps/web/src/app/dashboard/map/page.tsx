"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import mapboxgl from "mapbox-gl";
import { REGIONS } from "@/lib/regions";
import { apiFetch } from '@/lib/apiFetch';


const fetcher = (u: string) => apiFetch(u).then(r => r.json());

export default function MapPage() {
  const [hours, setHours] = useState(168);
  const key = useMemo(() => `/api/alerts/regions?sinceHours=${hours}`, [hours]);
  const { data } = useSWR(key, fetcher, { refreshInterval: 10000 });
  const { data: precise } = useSWR("/api/alerts?verified=true&limit=200", fetcher, { refreshInterval: 30000 });

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;
    if (mapInstance.current) return;
    mapboxgl.accessToken = token as string;
    const map = new mapboxgl.Map({
      container: mapRef.current!,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-98.5795, 39.8283],
      zoom: 3.3,
    });
    mapInstance.current = map;
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !data?.regions) return;

    // clear existing markers by removing all with a known class
    const existing = document.querySelectorAll('.shomer-marker');
    existing.forEach(el => el.remove());

    Object.entries(data.regions).forEach(([region, counts]) => {
      const coords = REGIONS[region];
      if (!coords) return;
      const el = document.createElement('div');
      el.className = 'shomer-marker';
      const total = (counts as any).total ?? 0;
      const high = (counts as any).HIGH ?? 0;
      el.style.cssText = `background:${high>0?"#ef4444":"#0ea5e9"};color:white;border-radius:9999px;padding:6px 8px;font-size:12px;`;
      el.textContent = String(total);
      new mapboxgl.Marker(el).setLngLat([coords.lng, coords.lat]).setPopup(new mapboxgl.Popup().setHTML(`<strong>${region}</strong><br/>High: ${high}<br/>Total: ${total}`)).addTo(map);
    });
  }, [data]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !precise?.alerts) return;
    precise.alerts.forEach((a: any) => {
      if (!a.lat || !a.lng) return;
      new mapboxgl.Marker({ color: "#0ea5e9" })
        .setLngLat([a.lng, a.lat])
        .setPopup(new mapboxgl.Popup().setHTML(`<b>${a.title}</b><br/>Score: ${a.score}`))
        .addTo(map);
    });
  }, [precise]);

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">Map — Alerts by Region</h1>
        <a href="/dashboard" className="text-sm underline">Back</a>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <label className="text-sm">Window (hours):</label>
        <input type="range" min={6} max={720} step={6} value={hours} onChange={e=>setHours(Number(e.target.value))} />
        <span className="text-sm">{hours}h</span>
      </div>

      {/* Legend chip */}
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1 text-xs shadow-sm">
        <span className="font-medium">Legend:</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background:'#ef4444' }}></span>High activity</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background:'#0ea5e9' }}></span>Normal/points</span>
      </div>

      <div ref={mapRef} style={{ height: 540 }} />
    </main>
  );
}


