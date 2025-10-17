'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, Plus, Search, Loader2, FileCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { Input } from '@/components/ui/input';
import { EvidenceCard, type Evidence } from '@/components/EvidenceCard';
import { ChainOfCustodyTimeline, type ChainOfCustodyEvent } from '@/components/ChainOfCustodyTimeline';
import { apiFetch } from '@/lib/apiFetch';


interface EvidenceListResponse {
  items: Evidence[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export default function EvidenceListPage() {
  const router = useRouter();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [custodyEvents, setCustodyEvents] = useState<ChainOfCustodyEvent[]>([]);
  const [viewingCustody, setViewingCustody] = useState(false);

  const fetchEvidence = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<EvidenceListResponse>(
        `/api/v1/evidence?page=${page}&page_size=10`
      );
      setEvidence(data.items);
      setTotalPages(data.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch evidence');
    } finally {
      setLoading(false);
    }
  }, [page]);

  // Fetch evidence list
  useEffect(() => {
    if (isFeatureEnabled('EVIDENCE')) {
      fetchEvidence();
    }
  }, [fetchEvidence]);

  // Check if feature is enabled
  if (!isFeatureEnabled('EVIDENCE')) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Evidence submission feature is not enabled. Contact your administrator to enable
            FEATURE_EVIDENCE.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleView = async (ev: Evidence) => {
    setSelectedEvidence(ev);
    setViewingCustody(true);
    try {
      const events = await apiFetch<ChainOfCustodyEvent[]>(
        `/api/v1/evidence/${ev.id}/chain-of-custody`
      );
      setCustodyEvents(events);
    } catch (err) {
      console.error('Failed to fetch chain of custody:', err);
    }
  };

  const handleVerify = async (ev: Evidence) => {
    try {
      const result = await apiFetch(`/api/v1/evidence/${ev.id}/verify`, {
        method: 'POST',
      });
      alert(result.message || 'Verification complete');
      fetchEvidence(); // Refresh list
    } catch (err) {
      alert('Verification failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDownloadPdf = async (ev: Evidence) => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1];
      
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/evidence/${ev.id}/export-chain-of-custody`;
      
      const response = await apiFetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to download PDF');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `chain-of-custody_${ev.reference_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      alert('PDF download failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleSeal = async (ev: Evidence) => {
    const reason = prompt('Enter reason for sealing this evidence:');
    if (!reason) return;

    try {
      await apiFetch(`/api/v1/evidence/${ev.id}/seal`, {
        method: 'POST',
        body: JSON.stringify({
          evidence_id: ev.id,
          reason,
        }),
      });
      alert('Evidence sealed successfully');
      fetchEvidence(); // Refresh list
    } catch (err) {
      alert('Seal failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Evidence Management</h1>
            <p className="text-slate-600">
              View and manage submitted evidence with chain-of-custody tracking
            </p>
          </div>
        </div>
        <Button onClick={() => router.push('/dashboard/evidence')}>
          <Plus className="h-4 w-4 mr-2" />
          Submit Evidence
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Search Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                placeholder="Search by reference number, hash, or description..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline">Filter</Button>
            <Button variant="outline">Sort</Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-900">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Chain of Custody Modal/View */}
      {viewingCustody && selectedEvidence && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Chain of Custody</CardTitle>
                <CardDescription>{selectedEvidence.reference_number}</CardDescription>
              </div>
              <Button variant="outline" onClick={() => setViewingCustody(false)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ChainOfCustodyTimeline events={custodyEvents} />
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-slate-600">Loading evidence...</span>
        </div>
      )}

      {/* Evidence List */}
      {!loading && evidence.length > 0 && (
        <div className="grid gap-4">
          {evidence
            .filter(ev => 
              !searchQuery || 
              ev.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
              ev.sha256_hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
              ev.filename.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((ev) => (
              <EvidenceCard
                key={ev.id}
                evidence={ev}
                onView={handleView}
                onVerify={handleVerify}
                onDownloadPdf={handleDownloadPdf}
                onSeal={handleSeal}
              />
            ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && evidence.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileCheck className="h-16 w-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No Evidence Found</h3>
            <p className="text-slate-500 mb-4">
              No evidence has been submitted yet.
            </p>
            <Button onClick={() => router.push('/dashboard/evidence')}>
              <Plus className="h-4 w-4 mr-2" />
              Submit First Evidence
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

