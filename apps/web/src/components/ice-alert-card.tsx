/**
 * ICE Alert Card Component
 * Displays an individual ICE alert with severity styling and actions
 */

import React from 'react';
import Link from 'next/link';

interface ICEAlertCardProps {
  alert: {
    id: number;
    location: string;
    description: string;
    severity: 'rumor' | 'verified' | 'active';
    verified: boolean;
    created_at: string;
    expires_at: string;
  };
  showActions?: boolean;
  onShare?: () => void;
}

const severityConfig = {
  rumor: {
    emoji: 'ℹ️',
    label: 'Rumor',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-900',
    badgeColor: 'bg-gray-200 text-gray-800',
  },
  verified: {
    emoji: '⚠️',
    label: 'Verified',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-900',
    badgeColor: 'bg-orange-200 text-orange-900',
  },
  active: {
    emoji: '🚨',
    label: 'Active',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-900',
    badgeColor: 'bg-red-200 text-red-900',
  },
};

export default function ICEAlertCard({ alert, showActions = true, onShare }: ICEAlertCardProps) {
  const config = severityConfig[alert.severity];
  
  // Calculate time ago
  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMinutes = Math.floor((now.getTime() - then.getTime()) / 60000);
    
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
  };

  // Calculate time until expiration
  const getExpiresIn = (timestamp: string) => {
    const now = new Date();
    const expires = new Date(timestamp);
    const diffHours = Math.floor((expires.getTime() - now.getTime()) / 3600000);
    
    if (diffHours < 0) return 'Expired';
    if (diffHours < 24) return `Expires in ${diffHours}h`;
    return `Expires in ${Math.floor(diffHours / 24)}d`;
  };

  return (
    <div 
      className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-6 shadow-sm hover:shadow-md transition-shadow`}
      role="article"
      aria-label={`ICE Alert - ${config.label}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">{config.emoji}</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.badgeColor}`}>
            {config.label.toUpperCase()}
          </span>
          {alert.verified && (
            <span className="flex items-center gap-1 text-sm text-green-700">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Verified
            </span>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {getTimeAgo(alert.created_at)}
        </div>
      </div>

      {/* Location */}
      <div className="mb-3">
        <div className="flex items-center gap-2 text-gray-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-semibold">{alert.location}</span>
        </div>
      </div>

      {/* Description */}
      <p className={`text-base mb-4 ${config.textColor}`}>
        {alert.description}
      </p>

      {/* Know Your Rights Banner */}
      <div className="bg-blue-100 border border-blue-200 rounded-md p-3 mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <Link 
            href="/ice-guide"
            className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline"
          >
            Know Your Rights →
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          {getExpiresIn(alert.expires_at)}
        </div>
        
        {showActions && (
          <div className="flex gap-2">
            <button
              onClick={onShare}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-white rounded-md border border-gray-300 transition-colors flex items-center gap-1"
              aria-label="Share alert"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
            
            <Link
              href={`/dashboard/alerts/ice/${alert.id}`}
              className="px-3 py-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 hover:bg-white rounded-md border border-blue-300 transition-colors"
            >
              Details
            </Link>
          </div>
        )}
      </div>

      {/* Bilingual Label (Español) */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <button
          className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1"
          aria-label="View in Spanish"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
          Ver en Español
        </button>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for ICE Alert Card
 */
export function ICEAlertCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-gray-300 rounded"></div>
        <div className="w-24 h-6 bg-gray-300 rounded-full"></div>
      </div>
      <div className="w-48 h-5 bg-gray-300 rounded mb-3"></div>
      <div className="space-y-2 mb-4">
        <div className="w-full h-4 bg-gray-300 rounded"></div>
        <div className="w-3/4 h-4 bg-gray-300 rounded"></div>
      </div>
      <div className="w-full h-10 bg-blue-100 rounded mb-4"></div>
      <div className="flex justify-between">
        <div className="w-20 h-4 bg-gray-300 rounded"></div>
        <div className="flex gap-2">
          <div className="w-16 h-8 bg-gray-300 rounded"></div>
          <div className="w-16 h-8 bg-gray-300 rounded"></div>
        </div>
      </div>
    </div>
  );
}

