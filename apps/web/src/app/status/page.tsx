'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/apiFetch';


interface HealthStatus {
  ok: boolean;
  db: boolean;
  redis: string;
  ts: number;
  uptime: number;
  version: string;
  error?: string;
}

interface OnCallStatus {
  ok: boolean;
  current: Array<{
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    organizationId: string;
    organizationName: string;
    region: string | null;
    startsAt: string;
    endsAt: string;
  }>;
  upcoming: Array<{
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    organizationId: string;
    organizationName: string;
    region: string | null;
    startsAt: string;
    endsAt: string;
  }>;
  timestamp: string;
  error?: string;
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [onCall, setOnCall] = useState<OnCallStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch health status
        const healthResponse = await apiFetch('/api/health');
        const healthData = await healthResponse.json();
        setHealth(healthData);

        // Fetch on-call status
        const onCallResponse = await apiFetch('/api/oncall/status');
        const onCallData = await onCallResponse.json();
        setOnCall(onCallData);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch status');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: boolean | string) => {
    if (typeof status === 'boolean') {
      return status ? 'text-green-600' : 'text-red-600';
    }
    if (status === 'enabled') return 'text-green-600';
    if (status === 'disabled') return 'text-yellow-600';
    if (status === 'down') return 'text-red-600';
    return 'text-gray-600';
  };

  const getStatusIcon = (status: boolean | string) => {
    if (typeof status === 'boolean') {
      return status ? '✅' : '❌';
    }
    if (status === 'enabled') return '✅';
    if (status === 'disabled') return '⚠️';
    if (status === 'down') return '❌';
    return '❓';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Status Check Failed</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Shomer Status</h1>
          <p className="text-gray-600">System health and on-call information</p>
          {health && (
            <p className="text-sm text-gray-500 mt-2">
              Last updated: {new Date(health.ts).toLocaleString()}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Health Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="mr-2">🏥</span>
              System Health
            </h2>
            
            {health ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Overall Status</span>
                  <span className={`font-semibold ${getStatusColor(health.ok)}`}>
                    {getStatusIcon(health.ok)} {health.ok ? 'Healthy' : 'Unhealthy'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>Database</span>
                  <span className={`font-semibold ${getStatusColor(health.db)}`}>
                    {getStatusIcon(health.db)} {health.db ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>Redis</span>
                  <span className={`font-semibold ${getStatusColor(health.redis)}`}>
                    {getStatusIcon(health.redis)} {health.redis}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>Uptime</span>
                  <span className="text-gray-600">
                    {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>Version</span>
                  <span className="text-gray-600">{health.version}</span>
                </div>
              </div>
            ) : (
              <p className="text-red-600">Failed to load health status</p>
            )}
          </div>

          {/* On-Call Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <span className="mr-2">📞</span>
              On-Call Status
            </h2>
            
            {onCall ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Service Status</span>
                  <span className={`font-semibold ${getStatusColor(onCall.ok)}`}>
                    {getStatusIcon(onCall.ok)} {onCall.ok ? 'Available' : 'Unavailable'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>Currently On-Call</span>
                  <span className="text-gray-600">
                    {onCall.current.length} {onCall.current.length === 1 ? 'person' : 'people'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>Upcoming (24h)</span>
                  <span className="text-gray-600">
                    {onCall.upcoming.length} {onCall.upcoming.length === 1 ? 'person' : 'people'}
                  </span>
                </div>
                
                {onCall.current.length > 0 && (
                  <div className="mt-4 pt-3 border-t">
                    <h3 className="font-medium text-sm text-gray-700 mb-2">Current On-Call:</h3>
                    {onCall.current.map((person) => (
                      <div key={person.id} className="text-sm text-gray-600">
                        <div className="font-medium">{person.userName}</div>
                        <div className="text-xs">{person.organizationName}</div>
                        {person.region && (
                          <div className="text-xs text-gray-500">Region: {person.region}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-red-600">Failed to load on-call status</p>
            )}
          </div>
        </div>

        {/* System Information */}
        {health && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">System Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Server Time</span>
                <div className="text-gray-600">{new Date(health.ts).toLocaleString()}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Uptime</span>
                <div className="text-gray-600">
                  {Math.floor(health.uptime / 86400)}d {Math.floor((health.uptime % 86400) / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Version</span>
                <div className="text-gray-600">{health.version}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
