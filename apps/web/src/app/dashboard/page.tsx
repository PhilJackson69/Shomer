"use client";

import { useState, useEffect } from "react";
import { Map, Marker, Popup } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface Incident {
  id: string;
  type: "digital" | "physical";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  source?: string;
  subreddit?: string;
  author?: string;
  url?: string;
  score?: number;
  created_at: string;
  updated_at: string;
}

const severityColors = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export default function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const response = await fetch("/api/reports/incidents");
      if (!response.ok) {
        throw new Error("Failed to fetch incidents");
      }
      const data = await response.json();
      setIncidents(data.incidents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleScanReddit = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/digital-scan/digital-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keywords: ["synagogue", "jewish", "antisemitic"],
          limit: 20,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to scan Reddit");
      }

      const data = await response.json();
      console.log("Reddit scan completed:", data);
      
      // Refresh incidents after scan
      await fetchIncidents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading incidents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-gray-900">
                Shomer Dashboard
              </h1>
              <button
                onClick={handleScanReddit}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
              >
                {loading ? "Scanning..." : "Scan Reddit"}
              </button>
            </div>
            <p className="mt-2 text-gray-600">
              AI-powered community safety monitoring
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Map */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Incident Map</h2>
              <div className="h-96 rounded-lg overflow-hidden">
                <Map
                  mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
                  initialViewState={{
                    longitude: -74.006,
                    latitude: 40.7128,
                    zoom: 10,
                  }}
                  style={{ width: "100%", height: "100%" }}
                  mapStyle="mapbox://styles/mapbox/streets-v11"
                >
                  {incidents
                    .filter((incident) => incident.latitude && incident.longitude)
                    .map((incident) => (
                      <Marker
                        key={incident.id}
                        longitude={incident.longitude!}
                        latitude={incident.latitude!}
                        onClick={() => setSelectedIncident(incident)}
                      >
                        <div
                          className={`w-4 h-4 rounded-full cursor-pointer ${
                            incident.severity === "critical"
                              ? "bg-red-500"
                              : incident.severity === "high"
                              ? "bg-orange-500"
                              : incident.severity === "medium"
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                        />
                      </Marker>
                    ))}

                  {selectedIncident && (
                    <Popup
                      longitude={selectedIncident.longitude!}
                      latitude={selectedIncident.latitude!}
                      onClose={() => setSelectedIncident(null)}
                    >
                      <div className="p-2">
                        <h3 className="font-semibold">{selectedIncident.title}</h3>
                        <p className="text-sm text-gray-600">
                          {selectedIncident.description}
                        </p>
                        <div className="mt-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              severityColors[selectedIncident.severity]
                            }`}
                          >
                            {selectedIncident.severity.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </Popup>
                  )}
                </Map>
              </div>
            </div>
          </div>

          {/* Incidents List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                Recent Incidents ({incidents.length})
              </h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedIncident(incident)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-900">
                        {incident.title}
                      </h3>
                      <div className="flex space-x-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            severityColors[incident.severity]
                          }`}
                        >
                          {incident.severity.toUpperCase()}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {incident.type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {incident.description.length > 150
                        ? `${incident.description.substring(0, 150)}...`
                        : incident.description}
                    </p>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>
                        {incident.source && (
                          <>
                            Source: {incident.source}
                            {incident.subreddit && ` • r/${incident.subreddit}`}
                          </>
                        )}
                      </span>
                      <span>
                        {new Date(incident.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {incident.url && (
                      <a
                        href={incident.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-xs mt-1 block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Source →
                      </a>
                    )}
                  </div>
                ))}
                {incidents.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No incidents found. Click "Scan Reddit" to start monitoring.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}