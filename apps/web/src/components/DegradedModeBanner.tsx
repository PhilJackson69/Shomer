/**
 * Degraded Mode Banner Component
 * 
 * Lightweight banner that listens for degraded-mode events from apiFetch
 * and displays a non-intrusive notification to users.
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DegradedModeBannerProps {
  showBanner?: boolean; // Optional flag to control visibility
}

export function DegradedModeBanner({ showBanner = true }: DegradedModeBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!showBanner) return;

    const handleDegradedMode = () => {
      if (!isDismissed) {
        setIsVisible(true);
      }
    };

    // Listen for degraded-mode events from apiFetch
    window.addEventListener('degraded-mode', handleDegradedMode);

    // Check if already in degraded mode
    if (typeof window !== 'undefined' && window.__degraded && !isDismissed) {
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener('degraded-mode', handleDegradedMode);
    };
  }, [showBanner, isDismissed]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
  };

  if (!isVisible || !showBanner) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <p className="text-sm text-amber-800">
            <strong>Degraded Mode:</strong> Some services are experiencing issues. 
            Your data is safe and core functionality remains available.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-amber-600 hover:text-amber-800 transition-colors"
          aria-label="Dismiss degraded mode banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Hook to check degraded mode status
 */
export function useDegradedMode() {
  const [isDegraded, setIsDegraded] = useState(false);

  useEffect(() => {
    const handleDegradedMode = () => {
      setIsDegraded(true);
    };

    // Listen for degraded-mode events
    window.addEventListener('degraded-mode', handleDegradedMode);

    // Check initial state
    if (typeof window !== 'undefined' && window.__degraded) {
      setIsDegraded(true);
    }

    return () => {
      window.removeEventListener('degraded-mode', handleDegradedMode);
    };
  }, []);

  return isDegraded;
}
