'use client';

import { 
  Shield, 
  CheckCircle, 
  Eye, 
  Lock, 
  Archive,
  Download,
  Upload,
  Clock,
  AlertCircle,
  FileCheck
} from 'lucide-react';

export interface ChainOfCustodyEvent {
  id: number;
  action: string;
  action_by_name: string | null;
  action_by_user_email?: string | null;
  timestamp: string;
  description: string | null;
  notes?: string | null;
  ip_address: string | null;
  hash_verified?: boolean | null;
  hash_match?: boolean | null;
  evidence_status_at_time: string;
}

interface ChainOfCustodyTimelineProps {
  events: ChainOfCustodyEvent[];
  className?: string;
}

const actionConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  submitted: {
    label: 'Submitted',
    icon: <Upload className="h-4 w-4" />,
    color: 'bg-blue-500',
  },
  received: {
    label: 'Received',
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'bg-green-500',
  },
  verified: {
    label: 'Verified',
    icon: <FileCheck className="h-4 w-4" />,
    color: 'bg-emerald-500',
  },
  accessed: {
    label: 'Accessed',
    icon: <Eye className="h-4 w-4" />,
    color: 'bg-yellow-500',
  },
  sealed: {
    label: 'Sealed',
    icon: <Lock className="h-4 w-4" />,
    color: 'bg-indigo-500',
  },
  exported: {
    label: 'Exported',
    icon: <Download className="h-4 w-4" />,
    color: 'bg-purple-500',
  },
  archived: {
    label: 'Archived',
    icon: <Archive className="h-4 w-4" />,
    color: 'bg-gray-500',
  },
  transferred: {
    label: 'Transferred',
    icon: <Shield className="h-4 w-4" />,
    color: 'bg-orange-500',
  },
  destroyed: {
    label: 'Destroyed',
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'bg-red-500',
  },
};

export function ChainOfCustodyTimeline({ events, className = '' }: ChainOfCustodyTimelineProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-6 w-6 text-primary" />
        <h3 className="text-xl font-semibold">Chain of Custody</h3>
        <span className="text-sm text-slate-500">({events.length} events)</span>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />

        {/* Timeline events */}
        <div className="space-y-6">
          {events.map((event, index) => {
            const actionInfo = actionConfig[event.action.toLowerCase()] || {
              label: event.action,
              icon: <Clock className="h-4 w-4" />,
              color: 'bg-slate-500',
            };
            const { date, time } = formatDate(event.timestamp);

            return (
              <div key={event.id} className="relative pl-16">
                {/* Timeline dot and icon */}
                <div className={`absolute left-3 -translate-x-1/2 w-6 h-6 rounded-full ${actionInfo.color} flex items-center justify-center text-white z-10`}>
                  {actionInfo.icon}
                </div>

                {/* Event card */}
                <div className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {actionInfo.label}
                      </h4>
                      <p className="text-sm text-slate-600">
                        by {event.action_by_user_email || event.action_by_name || 'System'}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div className="font-medium">{date}</div>
                      <div className="text-slate-400">{time} UTC</div>
                    </div>
                  </div>

                  {/* Description */}
                  {event.description && (
                    <p className="text-sm text-slate-700 mb-2">
                      {event.description}
                    </p>
                  )}

                  {/* Notes */}
                  {event.notes && (
                    <div className="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mb-2">
                      <span className="font-medium">Note:</span> {event.notes}
                    </div>
                  )}

                  {/* Hash verification */}
                  {event.hash_verified && (
                    <div className={`text-sm p-2 rounded ${
                      event.hash_match 
                        ? 'bg-green-50 text-green-800 border border-green-200' 
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        {event.hash_match ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        <span className="font-medium">
                          {event.hash_match ? 'Hash Verified ✓' : 'Hash Mismatch ✗'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
                    {event.ip_address && (
                      <div className="flex items-center gap-1">
                        <span className="font-mono">{event.ip_address}</span>
                      </div>
                    )}
                    {event.evidence_status_at_time && (
                      <div className="flex items-center gap-1">
                        <span>Status: </span>
                        <span className="font-medium uppercase">{event.evidence_status_at_time}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {events.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p>No chain-of-custody events recorded yet.</p>
        </div>
      )}
    </div>
  );
}

