"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiFetchJson } from "@/lib/apiFetch";

interface SystemMetrics {
  total_users: number;
  total_tips: number;
  total_incidents: number;
  rate_limit_violations_7d: number;
  system_health: string;
  uptime_hours: number;
  last_7d_totals: {
    tips: number;
    incidents: number;
    users: number;
    rate_limit_violations: number;
  };
}

interface SystemHealth {
  status: string;
  database: string;
  redis: string;
  disk_usage: number;
  memory_usage: number;
  last_check: string;
}

export default function AdminSystemCard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemData();
  }, []);

  const fetchSystemData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsData, healthData] = await Promise.all([
        apiFetchJson<SystemMetrics>("/api/v1/system/metrics"),
        apiFetchJson<SystemHealth>("/api/v1/system/health"),
      ]);

      setMetrics(metricsData);
      setHealth(healthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch system data");
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-800";
      case "degraded":
        return "bg-yellow-100 text-yellow-800";
      case "critical":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return "✅";
      case "degraded":
        return "⚠️";
      case "critical":
        return "🚨";
      default:
        return "❓";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
          <CardDescription>Loading system metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
          <CardDescription>Error loading system data</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getHealthIcon(health?.status || "unknown")}
            System Health
          </CardTitle>
          <CardDescription>
            Last checked: {health?.last_check ? new Date(health.last_check).toLocaleString() : "Unknown"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold mb-1">
                <Badge className={getHealthColor(health?.status || "unknown")}>
                  {health?.status || "Unknown"}
                </Badge>
              </div>
              <div className="text-sm text-gray-600">Overall Status</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold mb-1">
                <Badge className={getHealthColor(health?.database || "unknown")}>
                  {health?.database || "Unknown"}
                </Badge>
              </div>
              <div className="text-sm text-gray-600">Database</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold mb-1">
                <Badge className={getHealthColor(health?.redis || "unknown")}>
                  {health?.redis || "Unknown"}
                </Badge>
              </div>
              <div className="text-sm text-gray-600">Redis</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold mb-1">
                {Math.round(health?.uptime_hours || 0)}h
              </div>
              <div className="text-sm text-gray-600">Uptime</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>System Metrics</CardTitle>
          <CardDescription>Current system statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {metrics?.total_users || 0}
              </div>
              <div className="text-sm text-gray-600">Total Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {metrics?.total_tips || 0}
              </div>
              <div className="text-sm text-gray-600">Total Tips</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {metrics?.total_incidents || 0}
              </div>
              <div className="text-sm text-gray-600">Total Incidents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 mb-1">
                {metrics?.rate_limit_violations_7d || 0}
              </div>
              <div className="text-sm text-gray-600">Rate Limit Violations (7d)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 7-Day Activity */}
      <Card>
        <CardHeader>
          <CardTitle>7-Day Activity</CardTitle>
          <CardDescription>Recent system activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {metrics?.last_7d_totals.users || 0}
              </div>
              <div className="text-sm text-gray-600">New Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {metrics?.last_7d_totals.tips || 0}
              </div>
              <div className="text-sm text-gray-600">New Tips</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {metrics?.last_7d_totals.incidents || 0}
              </div>
              <div className="text-sm text-gray-600">New Incidents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 mb-1">
                {metrics?.last_7d_totals.rate_limit_violations || 0}
              </div>
              <div className="text-sm text-gray-600">Rate Limit Violations</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resource Usage */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle>Resource Usage</CardTitle>
            <CardDescription>System resource utilization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Disk Usage</span>
                  <span className="text-sm text-gray-600">{health.disk_usage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      health.disk_usage > 90 ? "bg-red-500" : 
                      health.disk_usage > 70 ? "bg-yellow-500" : "bg-green-500"
                    }`}
                    style={{ width: `${health.disk_usage}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Memory Usage</span>
                  <span className="text-sm text-gray-600">{health.memory_usage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      health.memory_usage > 90 ? "bg-red-500" : 
                      health.memory_usage > 70 ? "bg-yellow-500" : "bg-green-500"
                    }`}
                    style={{ width: `${health.memory_usage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
