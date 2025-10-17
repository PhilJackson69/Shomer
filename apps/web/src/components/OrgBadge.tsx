"use client";
import useSWR from "swr";
import { apiFetch } from '@/lib/apiFetch';


const fetcher = (u: string) => apiFetch(u).then(r => r.json());

export default function OrgBadge() {
  const { data } = useSWR("/api/org/me", fetcher);
  const org = data?.org;
  return (
    <span className="text-xs rounded-lg border px-2 py-1 bg-white/70 dark:bg-neutral-800">
      {org ? `Org: ${org.name}` : "Org: —"}
    </span>
  );
}


