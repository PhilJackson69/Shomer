"use client";

import { useState, useEffect } from "react";
import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from '@/lib/apiFetch';


interface SourceFeed {
  id: string;
  type: string;
  name: string;
  endpoint: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastCursor?: string;
  _count: {
    rawIngests: number;
  };
}

interface SourcesResponse {
  success: boolean;
  sources: SourceFeed[];
  count: number;
}

export default function ThreatSourcesPage() {
  const [sources, setSources] = useState<SourceFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSource, setNewSource] = useState({
    type: "RSS",
    name: "",
    endpoint: "",
  });

  const fetchSources = async () => {
    try {
      setLoading(true);
      const response = await apiFetch("/api/threat-detection/sources");
      const data: SourcesResponse = await response.json();

      if (data.success) {
        setSources(data.sources);
      } else {
        setError("Failed to fetch sources");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = async (sourceId: string, enabled: boolean) => {
    try {
      const response = await apiFetch("/api/threat-detection/sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sourceId, enabled }),
      });

      const data = await response.json();
      if (data.success) {
        // Update local state
        setSources(prev => 
          prev.map(source => 
            source.id === sourceId ? { ...source, enabled } : source
          )
        );
      } else {
        setError("Failed to update source");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const addSource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiFetch("/api/threat-detection/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSource),
      });

      const data = await response.json();
      if (data.success) {
        setSources(prev => [data.source, ...prev]);
        setNewSource({ type: "RSS", name: "", endpoint: "" });
        setError(null);
      } else {
        setError(data.error || "Failed to add source");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const deleteSource = async (sourceId: string) => {
    if (!confirm("Are you sure you want to delete this source? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await apiFetch(`/api/threat-detection/sources?id=${sourceId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        setSources(prev => prev.filter(source => source.id !== sourceId));
      } else {
        setError(data.error || "Failed to delete source");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "REDDIT": return "bg-orange-100 text-orange-800";
      case "RSS": return "bg-blue-100 text-blue-800";
      case "TELEGRAM": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const defaultFeeds = [
    { type: "RSS", name: "SF Chronicle News", endpoint: "https://www.sfchronicle.com/rss/news/" },
    { type: "RSS", name: "CISA Security Advisories", endpoint: "https://www.cisa.gov/news.xml" },
    { type: "RSS", name: "LA Times News", endpoint: "https://www.latimes.com/rss2.0.xml" },
    { type: "REDDIT", name: "San Francisco", endpoint: "SanFrancisco" },
    { type: "REDDIT", name: "Los Angeles", endpoint: "LosAngeles" },
    { type: "REDDIT", name: "Jewish", endpoint: "Jewish" },
  ];

  if (loading && sources.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading threat sources...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Threat Sources</h1>
          <p className="text-gray-600">Manage data sources for threat detection</p>
        </div>
      </div>

      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Add New Source */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Source</CardTitle>
          <CardDescription>Add a new data source for threat detection</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={addSource} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <select
                  value={newSource.type}
                  onChange={(e) => setNewSource(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full p-2 border rounded"
                  required
                >
                  <option value="RSS">RSS Feed</option>
                  <option value="REDDIT">Reddit Subreddit</option>
                  <option value="TELEGRAM">Telegram Channel</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={newSource.name}
                  onChange={(e) => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2 border rounded"
                  placeholder="Source name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {newSource.type === "REDDIT" ? "Subreddit" : "Endpoint URL"}
                </label>
                <input
                  type="text"
                  value={newSource.endpoint}
                  onChange={(e) => setNewSource(prev => ({ ...prev, endpoint: e.target.value }))}
                  className="w-full p-2 border rounded"
                  placeholder={newSource.type === "REDDIT" ? "subreddit_name" : "https://example.com/feed.xml"}
                  required
                />
              </div>
            </div>
            <Button type="submit">Add Source</Button>
          </form>
        </CardContent>
      </Card>

      {/* Default Feeds */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Add Default Feeds</CardTitle>
          <CardDescription>Add common threat detection sources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {defaultFeeds.map((feed, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">{feed.name}</div>
                  <div className="text-sm text-gray-600">{feed.endpoint}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNewSource(feed);
                    // Auto-submit the form
                    setTimeout(() => {
                      const form = document.querySelector('form');
                      if (form) form.requestSubmit();
                    }, 100);
                  }}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sources List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Current Sources ({sources.length})</h2>
        {sources.map((source) => (
          <Card key={source.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getTypeColor(source.type)}>
                      {source.type}
                    </Badge>
                    <span className="font-semibold">{source.name}</span>
                  </div>
                  <CardDescription>
                    {source.endpoint} • {source._count.rawIngests} items collected
                  </CardDescription>
                  <div className="text-sm text-gray-600">
                    Created: {new Date(source.createdAt).toLocaleDateString()}
                    {source.lastCursor && ` • Last cursor: ${source.lastCursor}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Enabled</span>
                    <Switch
                      checked={source.enabled}
                      onCheckedChange={(enabled) => toggleSource(source.id, enabled)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteSource(source.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete
                  </Button>
                  <TestPullButton id={source.id} disabled={!source.enabled} />
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {sources.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">No sources configured yet.</p>
            <p className="text-sm text-gray-500 mt-2">Add sources above to start collecting data.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TestPullButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const [pending, start] = React.useTransition();
  return (
    <button
      className="px-2 py-1 rounded-lg border hover:bg-gray-50"
      disabled={pending || disabled}
      onClick={() =>
        start(async () => {
          await apiFetch(`/api/threat-sources/${id}/test-pull`, { method: "POST" });
          if (typeof window !== "undefined") window.location.reload();
        })
      }
    >
      {pending ? "Pulling…" : "Test pull"}
    </button>
  );
}
