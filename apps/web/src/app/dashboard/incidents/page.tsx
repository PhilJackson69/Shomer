import IncidentTable from "./table";
import { SeverityFilterChips } from "./components/SeverityFilterChips";

export default async function IncidentsPage() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Incident Triage</h1>
        <SeverityFilterChips />
      </div>
      <IncidentTable />
    </div>
  );
}

