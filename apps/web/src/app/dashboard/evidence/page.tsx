'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Shield, Upload, FileCheck, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { apiFetch } from '@/lib/apiFetch';


const EVIDENCE_TYPES = [
  { value: 'photo', label: 'Photo' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio Recording' },
  { value: 'document', label: 'Document' },
  { value: 'other', label: 'Other' },
];

export default function EvidenceSubmissionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [fileHash, setFileHash] = useState('');
  const [formData, setFormData] = useState({
    evidence_type: '',
    description: '',
    location: '',
    tags: '',
    incident_id: '',
    tip_id: '',
  });

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      toast({
        title: 'File required',
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', file);
      formDataToSend.append('evidence_type', formData.evidence_type);
      if (formData.description) formDataToSend.append('description', formData.description);
      if (formData.location) formDataToSend.append('location', formData.location);
      if (formData.tags) formDataToSend.append('tags', formData.tags);
      if (formData.incident_id) formDataToSend.append('incident_id', formData.incident_id);
      if (formData.tip_id) formDataToSend.append('tip_id', formData.tip_id);

      const response = await apiFetch('http://localhost:8000/api/v1/evidence/upload', {
        method: 'POST',
        credentials: 'include',
        body: formDataToSend,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to upload evidence');
      }

      const result = await response.json();
      setReferenceNumber(result.reference_number);
      setFileHash(result.sha256_hash);
      setSubmitted(true);

      toast({
        title: 'Evidence uploaded successfully',
        description: `Reference: ${result.reference_number}`,
      });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Evidence Submitted Successfully</CardTitle>
            <CardDescription>
              Your evidence has been securely uploaded with cryptographic verification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Reference Number */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Reference Number</p>
                  <p className="text-xl font-mono font-bold text-slate-900 mt-1">
                    {referenceNumber}
                  </p>
                </div>
                <FileCheck className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            {/* File Hash */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-600 mb-2">SHA-256 Hash</p>
              <p className="text-xs font-mono text-slate-700 break-all">{fileHash}</p>
              <p className="text-xs text-slate-500 mt-2">
                This hash proves the authenticity and integrity of your evidence
              </p>
            </div>

            {/* Chain of Custody Info */}
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <strong>Chain of Custody Initiated:</strong>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
                  <li>File uploaded and hashed</li>
                  <li>Cryptographic signature generated</li>
                  <li>Initial custody record created</li>
                  <li>All future actions will be logged</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSubmitted(false);
                  setReferenceNumber('');
                  setFileHash('');
                  setFile(null);
                  setFormData({
                    evidence_type: '',
                    description: '',
                    location: '',
                    tags: '',
                    incident_id: '',
                    tip_id: '',
                  });
                }}
              >
                Upload More Evidence
              </Button>
              <Button className="flex-1" onClick={() => router.push('/dashboard/evidence/list')}>
                View Evidence List
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Submit Evidence</h1>
        </div>
        <p className="text-slate-600">
          Secure evidence submission with automatic hash calculation and chain-of-custody tracking
        </p>
      </div>

      {/* Security Notice */}
      <Alert className="mb-6 border-blue-200 bg-blue-50">
        <FileCheck className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          <strong>Secure Processing:</strong> Your file will be cryptographically hashed (SHA-256)
          upon upload. This creates an immutable record that can be used to verify the file hasn{"\'"}t
          been tampered with. All actions are logged in the chain-of-custody.
        </AlertDescription>
      </Alert>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence Information</CardTitle>
          <CardDescription>
            All fields except description and linking fields are required
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="file">
                Evidence File <span className="text-red-500">*</span>
              </Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileChange}
                required
                className="cursor-pointer"
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-green-600 mt-2">
                  <Upload className="h-4 w-4" />
                  <span>
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Maximum file size: 100MB. Hash will be calculated automatically.
              </p>
            </div>

            {/* Evidence Type */}
            <div className="space-y-2">
              <Label htmlFor="evidence_type">
                Evidence Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.evidence_type}
                onValueChange={(value) => setFormData({ ...formData, evidence_type: value })}
                required
              >
                <SelectTrigger id="evidence_type">
                  <SelectValue placeholder="Select evidence type" />
                </SelectTrigger>
                <SelectContent>
                  {EVIDENCE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe the evidence... (e.g., 'Security camera footage from main entrance')"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                type="text"
                placeholder="e.g., 'Building A, Floor 2'"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (Optional)</Label>
              <Input
                id="tags"
                type="text"
                placeholder="Comma-separated tags (e.g., 'weapon, vehicle, suspect')"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
              <p className="text-xs text-slate-500">
                Tags help organize and search evidence later
              </p>
            </div>

            {/* Link to Incident/Tip */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="incident_id">Link to Incident (Optional)</Label>
                <Input
                  id="incident_id"
                  type="number"
                  placeholder="Incident ID"
                  value={formData.incident_id}
                  onChange={(e) => setFormData({ ...formData, incident_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tip_id">Link to Tip (Optional)</Label>
                <Input
                  id="tip_id"
                  type="number"
                  placeholder="Tip ID"
                  value={formData.tip_id}
                  onChange={(e) => setFormData({ ...formData, tip_id: e.target.value })}
                />
              </div>
            </div>

            {/* Warning */}
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900">
                <strong>Important:</strong> Once uploaded, evidence cannot be modified. A complete
                chain-of-custody will be maintained. Only upload evidence you are authorized to
                submit.
              </AlertDescription>
            </Alert>

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading || !file}>
                {loading ? 'Uploading...' : 'Submit Evidence'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

