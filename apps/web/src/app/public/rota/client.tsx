'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Users, Calendar, Download, Copy, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';


interface Shift {
  id: string;
  user: {
    id: string;
    name: string;
    email?: string;
  };
  startsAt: string;
  endsAt: string;
  region?: string;
}

interface PublicRotaData {
  ok: boolean;
  org: {
    id: string;
    name: string;
  };
  settings: {
    preferredTimezone: string;
    displayName: string | null;
    showRegion: boolean;
    timeFormat: "24h" | "12h";
  };
  window: {
    from: string;
    to: string;
  };
  now: Shift | null;
  upcoming: Shift[];
}

interface PublicRotaClientProps {
  token: string;
  from?: string;
  to?: string;
  orgName: string;
}

export default function PublicRotaClient({ token, from, to, orgName }: PublicRotaClientProps) {
  const [data, setData] = useState<PublicRotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams({ token });
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const response = await apiFetch(`/api/public/oncall/summary?${params}`);
      const result = await response.json();

      if (result.ok) {
        setData(result);
        setLastUpdated(new Date());
      } else {
        setError(result.error || 'Failed to load data');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [token, from, to]);

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDateTime = (isoString: string) => {
    if (!data?.settings) {
      const date = new Date(isoString);
      return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    }

    const date = new Date(isoString);
    const options: Intl.DateTimeFormatOptions = {
      timeZone: data.settings.preferredTimezone,
      hourCycle: data.settings.timeFormat === "12h" ? "h12" : "h23",
    };

    return {
      date: new Intl.DateTimeFormat("en-US", { ...options, dateStyle: "short" }).format(date),
      time: new Intl.DateTimeFormat("en-US", { ...options, timeStyle: "short" }).format(date),
    };
  };

  const formatTimeRange = (startsAt: string, endsAt: string) => {
    if (!data?.settings) {
      const start = new Date(startsAt);
      const end = new Date(endsAt);
      return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const options: Intl.DateTimeFormatOptions = {
      timeZone: data.settings.preferredTimezone,
      hourCycle: data.settings.timeFormat === "12h" ? "h12" : "h23",
      timeStyle: "short",
    };

    return `${new Intl.DateTimeFormat("en-US", options).format(start)} – ${new Intl.DateTimeFormat("en-US", options).format(end)}`;
  };

  const getIcsUrl = () => {
    const params = new URLSearchParams({ token });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    // Use org's preferred timezone if available, otherwise use user's timezone
    const timezone = data?.settings?.preferredTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    params.set('tz', timezone);
    return `/api/oncall/rota.ics?${params}`;
  };

  const getCsvUrl = () => {
    const params = new URLSearchParams({ token });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return `/api/oncall/rota.csv?${params}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-2">Error: {error}</div>
        <button
          onClick={fetchData}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Current On-Call */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-blue-900 flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Current On-Call
          </h2>
          {data.now && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
              ON-CALL NOW
            </span>
          )}
        </div>

        {data.now ? (
          <div className="space-y-3">
            <div>
              <div className="text-xl font-semibold text-gray-900">
                {data.now.user.name}
              </div>
              {data.now.user.email && (
                <div className="text-sm text-gray-600">{data.now.user.email}</div>
              )}
              {data.now.region && data.settings.showRegion && (
                <div className="text-sm text-gray-500">Region: {data.now.region}</div>
              )}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="h-4 w-4 mr-1" />
              {formatTimeRange(data.now.startsAt, data.now.endsAt)}
            </div>
          </div>
        ) : (
          <div className="text-gray-600">
            No one is currently on-call
          </div>
        )}
      </div>

      {/* Upcoming Shifts */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          Next 7 Days
        </h2>

        {data.upcoming.length > 0 ? (
          <div className="space-y-3">
            {data.upcoming.slice(0, 7).map((shift) => {
              const startDate = formatDateTime(shift.startsAt);
              return (
                <div key={shift.id} className="flex items-center justify-between p-4 bg-white border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{shift.user.name}</div>
                    {shift.user.email && (
                      <div className="text-sm text-gray-600">{shift.user.email}</div>
                    )}
                    {shift.region && data.settings.showRegion && (
                      <div className="text-sm text-gray-500">Region: {shift.region}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{startDate.date}</div>
                    <div className="text-sm text-gray-600">{startDate.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600">
            No upcoming shifts scheduled
          </div>
        )}
      </div>

      {/* Export Links */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Download className="h-5 w-5 mr-2" />
          Export & Share
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ICS Export */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Add to Calendar (.ics)</div>
              <div className="text-sm text-gray-600">Import into your calendar app</div>
            </div>
            <div className="flex items-center space-x-2">
              <a
                href={getIcsUrl()}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </a>
              <button
                onClick={() => copyToClipboard(getIcsUrl(), 'ics')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* CSV Export */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium text-gray-900">Export CSV</div>
              <div className="text-sm text-gray-600">Spreadsheet format</div>
            </div>
            <div className="flex items-center space-x-2">
              <a
                href={getCsvUrl()}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </a>
              <button
                onClick={() => copyToClipboard(getCsvUrl(), 'csv')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Copy Success Messages */}
        {copySuccess && (
          <div className="mt-2 text-sm text-green-600">
            {copySuccess === 'ics' ? 'ICS link copied to clipboard!' : copySuccess === 'csv' ? 'CSV link copied to clipboard!' : copySuccess === 'json' ? 'JSON link copied to clipboard!' : 'SVG link copied to clipboard!'}
          </div>
        )}
      </div>

      {/* Embeds */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Copy className="h-5 w-5 mr-2" />
          Embeds
        </h3>
        
        <div className="space-y-4">
          {/* JSON Now */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              JSON {"\""}now{"\""} endpoint
            </label>
            <div className="flex">
              <input
                type="text"
                readOnly
                value={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/oncall/now?token=${token}`}
                className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 bg-gray-50 text-sm font-mono"
              />
              <button
                onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/oncall/now?token=${token}`, 'json')}
                className="bg-blue-600 text-white px-3 py-2 rounded-r-md hover:bg-blue-700 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>

          {/* SVG Badge */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SVG badge
            </label>
            <div className="flex">
              <input
                type="text"
                readOnly
                value={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/oncall/badge.svg?token=${token}&theme=light`}
                className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 bg-gray-50 text-sm font-mono"
              />
              <button
                onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/oncall/badge.svg?token=${token}&theme=light`, 'svg')}
                className="bg-blue-600 text-white px-3 py-2 rounded-r-md hover:bg-blue-700 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Embed Example */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              HTML embed snippet
            </label>
            <div className="bg-gray-100 rounded-md p-3">
              <code className="text-sm text-gray-800">
                {`<img alt="On-Call" src="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/oncall/badge.svg?token=${token}&theme=light" />`}
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t pt-4 text-center">
        <div className="flex items-center justify-center text-sm text-gray-600">
          <RefreshCw className="h-4 w-4 mr-1" />
          Auto-refreshing every 60s • Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
