'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  AlertTriangle, 
  ArrowLeft, 
  Loader2, 
  FileCheck, 
  Lock,
  Download,
  Link2,
  Copy,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { ChainOfCustodyTimeline, type ChainOfCustodyEvent } from '@/components/ChainOfCustodyTimeline';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/hooks/use-toast';


interface Evidence {
  id: number;
  reference_number: string;
  status: string;
  evidence_type: string;
  filename: string;
  file_size: number;
  mime_type: string;
  sha256_hash: string;
  md5_hash: string;
  description?: string;
  location?: string;
  tags?: string[];
  submitted_at?: string;
  received_at: string;
  verified_at?: string;
  sealed_at?: string;
  legal_hold: boolean;
  submitted_by_user_id?: number;
  custody_events_count: number;
  access_log_count: number;
}

interface SignedURLResponse {
  url: string;
  expires_in: number;
  reference_number: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
  sealed: 'bg-blue-100 text-blue-800',
  archived: 'bg-gray-100 text-gray-800',
};

export default function EvidenceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const evidenceId = params?.id as string;

  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [custodyEvents, setCustodyEvents] = useState<ChainOfCustodyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [generatingSignedUrl, setGeneratingSignedUrl] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (evidenceId) {
      fetchEvidenceDetails();
    }
  }, [evidenceId, fetchEvidenceDetails]);

  const fetchEvidenceDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch evidence details
      const evidenceData = await apiFetch<Evidence>(
        `/api/v1/evidence/${evidenceId}`
      );
      setEvidence(evidenceData);

      // Fetch chain of custody
      const events = await apiFetch<ChainOfCustodyEvent[]>(
        `/api/v1/evidence/${evidenceId}/chain-of-custody`
      );
      setCustodyEvents(events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch evidence details');
    } finally {
      setLoading(false);
    }
  }, [evidenceId]);

  const handleVerify = async () => {
    try {
      setVerifying(true);
      const result = await apiFetch<{ hash_match: boolean; message: string }>(
        `/api/v1/evidence/${evidenceId}/verify`,
        { method: 'POST' }
      );

      toast({
        title: result.hash_match ? 'Verification Successful' : 'Verification Failed',
        description: result.message,
        variant: result.hash_match ? 'default' : 'destructive',
      });

      // Refresh data
      await fetchEvidenceDetails();
    } catch (err) {
      toast({
        title: 'Verification Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleSeal = async () => {
    const reason = prompt('Enter reason for sealing this evidence:');
    if (!reason) return;

    try {
      setSealing(true);
      await apiFetch(`/api/v1/evidence/${evidenceId}/seal`, {
        method: 'POST',
        body: JSON.stringify({
          evidence_id: Number(evidenceId),
          reason,
        }),
      });

      toast({
        title: 'Evidence Sealed',
        description: 'Evidence has been sealed for legal proceedings.',
      });

      // Refresh data
      await fetchEvidenceDetails();
    } catch (err) {
      toast({
        title: 'Seal Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSealing(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1];
      
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/evidence/${evidenceId}/export-chain-of-custody`;
      
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
      a.download = `chain-of-custody_${evidence?.reference_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      toast({
        title: 'PDF Downloaded',
        description: 'Chain of custody PDF has been downloaded.',
      });
    } catch (err) {
      toast({
        title: 'Download Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleGetSignedUrl = async () => {
    try {
      setGeneratingSignedUrl(true);
      const result = await apiFetch<SignedURLResponse>(
        `/api/v1/evidence/${evidenceId}/export-chain-of-custody/signed-url`
      );
      
      setSignedUrl(result.url);
      
      toast({
        title: 'Signed URL Generated',
        description: `Valid for ${Math.floor(result.expires_in / 60)} minutes`,
      });
    } catch (err) {
      toast({
        title: 'Failed to Generate Signed URL',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setGeneratingSignedUrl(false);
    }
  };

  const handleCopySignedUrl = () => {
    if (signedUrl) {
      navigator.clipboard.writeText(signedUrl);
      toast({
        title: 'Copied!',
        description: 'Signed URL copied to clipboard.',
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-slate-600">Loading evidence details...</span>
        </div>
      </div>
    );
  }

  if (error || !evidence) {
    return (
      <div className="p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-900">
            {error || 'Evidence not found'}
          </AlertDescription>
        </Alert>
        <Button 
          variant="outline" 
          onClick={() => router.push('/dashboard/evidence/list')}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/dashboard/evidence/list')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{evidence.reference_number}</h1>
            <p className="text-slate-600">Evidence Details & Chain of Custody</p>
          </div>
        </div>
        <Badge className={statusColors[evidence.status] || 'bg-gray-100 text-gray-800'}>
          {evidence.status.toUpperCase()}
        </Badge>
      </div>

      {/* Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Perform operations on this evidence</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={handleVerify} 
              disabled={verifying}
              variant="default"
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileCheck className="h-4 w-4 mr-2" />
              )}
              Verify Hash
            </Button>

            <Button 
              onClick={handleSeal} 
              disabled={sealing || evidence.status === 'sealed'}
              variant="default"
            >
              {sealing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Seal Evidence
            </Button>

            <Button 
              onClick={handleDownloadPDF} 
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>

            <Button 
              onClick={handleGetSignedUrl}
              disabled={generatingSignedUrl}
              variant="outline"
            >
              {generatingSignedUrl ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Get Signed Link
            </Button>
          </div>

          {/* Signed URL Display */}
          {signedUrl && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Signed URL (expires in 10 minutes)
                  </p>
                  <p className="text-xs text-blue-700 font-mono break-all">
                    {signedUrl}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleCopySignedUrl}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence Metadata */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Evidence Metadata</CardTitle>
          <CardDescription>Cryptographic hashes and file information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Filename</h4>
              <p className="text-sm font-mono">{evidence.filename}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">File Size</h4>
              <p className="text-sm">{formatBytes(evidence.file_size)}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">MIME Type</h4>
              <p className="text-sm font-mono">{evidence.mime_type}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Evidence Type</h4>
              <p className="text-sm">{evidence.evidence_type}</p>
            </div>
            <div className="col-span-2">
              <h4 className="text-sm font-medium text-slate-500 mb-1">SHA-256 Hash</h4>
              <p className="text-xs font-mono bg-slate-100 p-2 rounded break-all">
                {evidence.sha256_hash}
              </p>
            </div>
            <div className="col-span-2">
              <h4 className="text-sm font-medium text-slate-500 mb-1">MD5 Hash</h4>
              <p className="text-xs font-mono bg-slate-100 p-2 rounded break-all">
                {evidence.md5_hash}
              </p>
            </div>
            {evidence.description && (
              <div className="col-span-2">
                <h4 className="text-sm font-medium text-slate-500 mb-1">Description</h4>
                <p className="text-sm">{evidence.description}</p>
              </div>
            )}
            {evidence.location && (
              <div className="col-span-2">
                <h4 className="text-sm font-medium text-slate-500 mb-1">Location</h4>
                <p className="text-sm">{evidence.location}</p>
              </div>
            )}
            {evidence.tags && evidence.tags.length > 0 && (
              <div className="col-span-2">
                <h4 className="text-sm font-medium text-slate-500 mb-1">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {evidence.tags.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timestamps */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Timestamps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Submitted</h4>
              <p className="text-sm">{formatDate(evidence.submitted_at)}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Received</h4>
              <p className="text-sm">{formatDate(evidence.received_at)}</p>
            </div>
            {evidence.verified_at && (
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-1">Verified</h4>
                <p className="text-sm">{formatDate(evidence.verified_at)}</p>
              </div>
            )}
            {evidence.sealed_at && (
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-1">Sealed</h4>
                <p className="text-sm">{formatDate(evidence.sealed_at)}</p>
              </div>
            )}
          </div>
          {evidence.legal_hold && (
            <Alert className="mt-4 border-red-200 bg-red-50">
              <Lock className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-900">
                This evidence is under legal hold and cannot be modified or deleted.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Chain of Custody Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Chain of Custody Timeline</CardTitle>
          <CardDescription>
            Complete immutable audit trail of all actions performed on this evidence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChainOfCustodyTimeline events={custodyEvents} />
        </CardContent>
      </Card>
    </div>
  );
}


