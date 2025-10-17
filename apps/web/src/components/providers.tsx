'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DegradedBanner />
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}

function DegradedBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => setShow((e as CustomEvent).detail?.active === true);
    if (typeof window !== 'undefined') {
      if ((window as any).__degraded) setShow(true);
      window.addEventListener('degraded-mode', handler as any);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('degraded-mode', handler as any);
      }
    };
  }, []);
  if (!show) return null;
  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 rounded-xl bg-yellow-200 px-4 py-2 text-sm shadow">
      Limited capacity — some requests may be delayed or rate-limited.
    </div>
  );
}

