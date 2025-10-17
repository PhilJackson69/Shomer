import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { findOrgByToken } from '@/lib/org-token';
import PublicRotaClient from './client';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PublicRotaPageProps {
  searchParams: Promise<{
    token?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function PublicRotaPage({ searchParams }: PublicRotaPageProps) {
  const params = await searchParams;
  const { token, from, to } = params;

  // Validate token is present
  if (!token) {
    notFound();
  }

  // Verify organization exists and token is valid
  const org = await findOrgByToken(token);
  if (!org) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
                <p className="text-sm text-gray-600 mt-1">On-Call Rota</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Public (read-only)
                </span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <Suspense fallback={
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            }>
              <PublicRotaClient 
                token={token}
                from={from}
                to={to}
                orgName={org.name}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
