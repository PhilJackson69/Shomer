/**
 * Security Banner Component
 * Handles security-related notifications and UX guardrails
 */

'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Shield, X } from 'lucide-react';

interface SecurityEvent {
  type: 'SESSION_RESET' | 'JWKS_ERROR' | 'LOGIN_ERROR' | 'FORCE_LOGOUT';
  message: string;
  error?: string;
}

interface SecurityBannerProps {
  onDismiss?: () => void;
}

export function SecurityBanner({ onDismiss }: SecurityBannerProps) {
  const [securityEvent, setSecurityEvent] = useState<SecurityEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen for security events
    const handleSecurityEvent = (event: CustomEvent<SecurityEvent>) => {
      setSecurityEvent(event.detail);
      setIsVisible(true);
      
      // Auto-dismiss after 10 seconds for non-critical events
      if (event.detail.type !== 'FORCE_LOGOUT') {
        setTimeout(() => {
          setIsVisible(false);
        }, 10000);
      }
    };

    // Listen for broadcast channel messages (cross-tab communication)
    const handleBroadcastMessage = (event: MessageEvent) => {
      if (event.data.type === 'FORCE_LOGOUT') {
        setSecurityEvent({
          type: 'FORCE_LOGOUT',
          message: event.data.reason || 'Session reset for security'
        });
        setIsVisible(true);
        
        // Force logout on this tab
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
    };

    // Set up event listeners
    window.addEventListener('shomer-security-event', handleSecurityEvent as EventListener);
    
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('shomer-auth');
      channel.addEventListener('message', handleBroadcastMessage);
      
      return () => {
        window.removeEventListener('shomer-security-event', handleSecurityEvent as EventListener);
        channel.removeEventListener('message', handleBroadcastMessage);
        channel.close();
      };
    }

    return () => {
      window.removeEventListener('shomer-security-event', handleSecurityEvent as EventListener);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible || !securityEvent) {
    return null;
  }

  const getBannerConfig = (type: SecurityEvent['type']) => {
    switch (type) {
      case 'SESSION_RESET':
        return {
          icon: Shield,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600',
        };
      case 'JWKS_ERROR':
      case 'LOGIN_ERROR':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600',
        };
      case 'FORCE_LOGOUT':
        return {
          icon: Shield,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
        };
      default:
        return {
          icon: AlertTriangle,
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
        };
    }
  };

  const config = getBannerConfig(securityEvent.type);
  const Icon = config.icon;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${config.bgColor} ${config.borderColor} border-b`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center">
            <Icon className={`h-5 w-5 ${config.iconColor} mr-3`} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${config.textColor}`}>
                {securityEvent.message}
              </p>
              {securityEvent.error && (
                <p className={`text-xs mt-1 ${config.textColor} opacity-75`}>
                  Technical details: {securityEvent.error}
                </p>
              )}
            </div>
          </div>
          
          {securityEvent.type !== 'FORCE_LOGOUT' && (
            <button
              onClick={handleDismiss}
              className={`ml-4 ${config.textColor} hover:opacity-75 transition-opacity`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to trigger security events programmatically
 */
export function useSecurityEvents() {
  const triggerSecurityEvent = (event: SecurityEvent) => {
    window.dispatchEvent(new CustomEvent('shomer-security-event', {
      detail: event
    }));
  };

  return { triggerSecurityEvent };
}
