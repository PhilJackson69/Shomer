"use client";

import { useState, useEffect } from "react";
import HealthPill from "./HealthPill";
import SnoozedBadge from "./SnoozedBadge";
import { SignalActions } from "./SignalActions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiFetch } from '@/lib/apiFetch';


interface ThreatSignal {
  id: string;
  score: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  indicators: string;
  rationale?: string;
  createdAt: string;
  raw: {
    id: string;
    title?: string;
    content: string;
    url: string;
    author?: string;
    publishedAt?: string;
    source: {
      id: string;
      name: string;
      type: string;
      endpoint: string;
    };
  };
  alertEvents: Array<{
    id: string;
    channel: string;
    success: boolean;
    deliveredAt?: string;
  }>;
}

interface SignalsResponse {
  success: boolean;
  signals: ThreatSignal[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  stats: {
    bySeverity: Array<{
      severity: string;
      _count: { severity: number };
      _avg: { score: number };
    }>;
  };
}

export default function ThreatSignalsPage() {
  const [signals, setSignals] = useState<ThreatSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSignals = async (pageNum: number = 1) => {
    try {
      setLoading(true);
      const response = await apiFetch(`/api/threat-detection/signals?page=${pageNum}&limit=20`);
      const data: SignalsResponse = await response.json();

      if (data.success) {
        setSignals(data.signals);
        setStats(data.stats);
        setTotalPages(data.pagination.pages);
        setPage(pageNum);
      } else {
        setError("Failed to fetch signals");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const updateSignalStatus = async (signalId: string, status: string) => {
    try {
      const response = await apiFetch(`/api/threat-detection/signals`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: signalId, status }),
      });

      const data = await response.json();
      if (data.success) {
        // Refresh the signals
        fetchSignals(page);
      } else {
        setError("Failed to update signal status");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const triggerCollection = async () => {
    try {
      const response = await apiFetch("/api/threat-detection/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: ["reddit", "rss"] }),
      });

      const data = await response.json();
      if (data.success) {
        // Refresh the signals after collection
        setTimeout(() => fetchSignals(page), 2000);
      } else {
        setError("Failed to trigger collection");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  useEffect(() => {
    fetchSignals();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "LOW": return "bg-yellow-100 text-yellow-800";
      case "MEDIUM": return "bg-orange-100 text-orange-800";
      case "HIGH": return "bg-red-100 text-red-800";
      case "CRITICAL": return "bg-red-900 text-red-100";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NEW": return "bg-blue-100 text-blue-800";
      case "ENRICHED": return "bg-purple-100 text-purple-800";
      case "SCORED": return "bg-indigo-100 text-indigo-800";
      case "ALERTED": return "bg-red-100 text-red-800";
      case "DISMISSED": return "bg-gray-100 text-gray-800";
      case "FALSE_POSITIVE": return "bg-green-100 text-green-800";
      case "CONFIRMED": return "bg-red-900 text-red-100";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading && signals.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading threat signals...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Threat Detection</h1>
          <p className="text-gray-600">Monitor and manage potential security threats</p>
        </div>
        <div className="flex items-center gap-3">
          <HealthPill />
          <Button onClick={triggerCollection} disabled={loading}>
            {loading ? "Collecting..." : "Trigger Collection"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.bySeverity.map((stat: any) => (
            <Card key={stat.severity}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{stat.severity}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat._count.severity}</div>
                <p className="text-xs text-gray-600">
                  Avg score: {stat._avg.score?.toFixed(2) || "N/A"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Signals List */}
      <div className="space-y-4">
        {signals.map((signal) => (
          <Card key={signal.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getSeverityColor(signal.severity)}>
                      {signal.severity}
                    </Badge>
                    <SnoozedBadge until={(signal as any).snoozeUntil as any} />
                    <Badge className={getStatusColor(signal.status)}>
                      {signal.status}
                    </Badge>
                    <span className="text-sm text-gray-600">Score: {signal.score.toFixed(2)}</span>
                  </div>
                  <CardTitle className="text-lg">
                    {signal.raw.title || "No title"}
                  </CardTitle>
                  <CardDescription>
                    Source: {signal.raw.source.name} ({signal.raw.source.type}) • 
                    {signal.raw.author && ` Author: ${signal.raw.author} •`}
                    {new Date(signal.createdAt).toLocaleString()}
                  </CardDescription>
                </div>
                <div className="flex gap-2 items-center">
                  {signal.status === "SCORED" && signal.severity !== "LOW" && (
                    null
                  )}
                  {/* Quick action buttons */}
                  <SignalActions id={signal.id} disabled={Boolean((signal as any).snoozeUntil && new Date((signal as any).snoozeUntil) > new Date())} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {signal.indicators && (
                  <div>
                    <strong>Indicators:</strong> {signal.indicators}
                  </div>
                )}
                {signal.rationale && (
                  <div>
                    <strong>Rationale:</strong> {signal.rationale}
                  </div>
                )}
                <div>
                  <strong>Content:</strong>
                  <p className="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded">
                    {signal.raw.content.slice(0, 300)}
                    {signal.raw.content.length > 300 && "..."}
                  </p>
                </div>
                <div className="flex justify-between items-center">
                  <a
                    href={signal.raw.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    View Original Source
                  </a>
                  {signal.alertEvents.length > 0 && (
                    <div className="text-sm text-gray-600">
                      {signal.alertEvents.filter(e => e.success).length} alert(s) sent
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => fetchSignals(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => fetchSignals(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {signals.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">No threat signals found.</p>
            <Button onClick={triggerCollection} className="mt-4">
              Start Collection
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
