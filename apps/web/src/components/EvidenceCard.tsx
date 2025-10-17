'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  FileCheck, 
  Lock, 
  Eye, 
  Download, 
  CheckCircle,
  AlertTriangle,
  Archive,
  Clock
} from 'lucide-react';

export interface Evidence {
  id: number;
  reference_number: string;
  evidence_type: string;
  status: string;
  filename: string;
  file_size: number;
  sha256_hash: string;
  submitted_at: string;
  received_at: string;
  verified_at?: string;
  sealed_at?: string;
  submitted_by_user_id?: number;
  custody_events_count: number;
  access_log_count: number;
}

interface EvidenceCardProps {
  evidence: Evidence;
  onView?: (evidence: Evidence) => void;
  onVerify?: (evidence: Evidence) => void;
  onDownloadPdf?: (evidence: Evidence) => void;
  onSeal?: (evidence: Evidence) => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: <Clock className="h-3 w-3" />,
  },
  verified: {
    label: 'Verified',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  sealed: {
    label: 'Sealed',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: <Lock className="h-3 w-3" />,
  },
  archived: {
    label: 'Archived',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: <Archive className="h-3 w-3" />,
  },
  destroyed: {
    label: 'Destroyed',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

const typeConfig: Record<string, { label: string; icon: string }> = {
  photo: { label: 'Photo', icon: '📷' },
  video: { label: 'Video', icon: '🎥' },
  audio: { label: 'Audio', icon: '🎵' },
  document: { label: 'Document', icon: '📄' },
  other: { label: 'Other', icon: '📦' },
};

export function EvidenceCard({ 
  evidence, 
  onView, 
  onVerify, 
  onDownloadPdf,
  onSeal 
}: EvidenceCardProps) {
  const statusInfo = statusConfig[evidence.status] || statusConfig.pending;
  const typeInfo = typeConfig[evidence.evidence_type] || typeConfig.other;
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="text-2xl mt-1">{typeInfo.icon}</div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="truncate">{evidence.filename}</span>
              </CardTitle>
              <CardDescription className="mt-1">
                <span className="font-mono text-xs">{evidence.reference_number}</span>
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.icon}
              <span>{statusInfo.label}</span>
            </div>
            <span className="text-xs text-slate-500">{typeInfo.label}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Evidence Details */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-slate-600">File Size:</span>
            <span className="ml-2 font-medium">{formatFileSize(evidence.file_size)}</span>
          </div>
          <div>
            <span className="text-slate-600">Received:</span>
            <span className="ml-2 font-medium">{formatDate(evidence.received_at)}</span>
          </div>
          {evidence.verified_at && (
            <div className="col-span-2">
              <span className="text-slate-600">Verified:</span>
              <span className="ml-2 font-medium text-green-600">{formatDate(evidence.verified_at)}</span>
            </div>
          )}
          {evidence.sealed_at && (
            <div className="col-span-2">
              <span className="text-slate-600">Sealed:</span>
              <span className="ml-2 font-medium text-blue-600">{formatDate(evidence.sealed_at)}</span>
            </div>
          )}
        </div>
        
        {/* Hash Display */}
        <div className="bg-slate-50 p-2 rounded border">
          <div className="text-xs text-slate-600 mb-1">SHA-256 Hash</div>
          <div className="font-mono text-xs break-all text-slate-800">
            {evidence.sha256_hash}
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            <span>{evidence.custody_events_count} custody events</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span>{evidence.access_log_count} access logs</span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-2 flex-wrap">
        {onView && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onView(evidence)}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        )}
        {onVerify && evidence.status !== 'sealed' && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onVerify(evidence)}
          >
            <FileCheck className="h-4 w-4 mr-1" />
            Verify
          </Button>
        )}
        {onDownloadPdf && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onDownloadPdf(evidence)}
          >
            <Download className="h-4 w-4 mr-1" />
            Download PDF
          </Button>
        )}
        {onSeal && evidence.status !== 'sealed' && (
          <Button 
            size="sm" 
            variant="secondary"
            onClick={() => onSeal(evidence)}
          >
            <Lock className="h-4 w-4 mr-1" />
            Seal
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

