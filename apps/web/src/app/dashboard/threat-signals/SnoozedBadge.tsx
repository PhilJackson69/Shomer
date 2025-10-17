export default function SnoozedBadge({ until }: { until?: string | Date | null }) {
  if (!until) return null;
  const now = new Date();
  const d = new Date(until);
  if (isNaN(d.getTime()) || d <= now) return null;

  return (
    <span className="ml-2 inline-flex items-center text-xs px-2 py-0.5 rounded-full border bg-yellow-100">
      Snoozed until {d.toLocaleString()}
    </span>
  );
}


