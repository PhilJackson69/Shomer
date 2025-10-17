'use client';

import { useState } from 'react';
import { apiFetch } from "@/lib/apiFetch";
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
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Shield, Upload, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const INCIDENT_TYPES = [
  'Suspicious Activity',
  'Threat',
  'Harassment',
  'Hate Speech',
  'Vandalism',
  'Other Safety Concern',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

interface TipFormData {
  incident_type: string;
  description: string;
  location: string;
  contact_email: string;
  contact_phone: string;
  consent: boolean;
}

export default function TipPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tipNumber, setTipNumber] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [formData, setFormData] = useState<TipFormData>({
    incident_type: '',
    description: '',
    location: '',
    contact_email: '',
    contact_phone: '',
    consent: false,
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhotoError('');

    if (!file) {
      setPhotoFile(null);
      return;
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setPhotoError(
        'Invalid file type. Please upload a JPEG, PNG, or WebP image.'
      );
      setPhotoFile(null);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setPhotoError(
        `File size exceeds 10MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`
      );
      setPhotoFile(null);
      return;
    }

    setPhotoFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.consent) {
      toast({
        title: 'Consent required',
        description: 'Please accept the privacy policy and terms to submit',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Prepare form data for submission
      const submitData = new FormData();
      submitData.append('incident_type', formData.incident_type);
      submitData.append('description', formData.description);
      submitData.append('location', formData.location);
      
      if (formData.contact_email) {
        submitData.append('contact_email', formData.contact_email);
      }
      if (formData.contact_phone) {
        submitData.append('contact_phone', formData.contact_phone);
      }
      
      if (photoFile) {
        submitData.append('photo', photoFile);
      }

      // Submit to API
      const response = await apiFetch('http://localhost:8000/api/v1/tips', { method: 'POST',
        body: submitData
      });

      const result = await response.json();
      setTipNumber(result.id || 'TIP-' + Date.now());
      setSubmitted(true);

      toast({
        title: 'Tip submitted successfully',
        description: 'Thank you for helping keep our community safe',
      });
    } catch (error) {
      toast({
        title: 'Submission failed',
        description: error instanceof Error ? error.message : 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="mx-auto max-w-2xl pt-20">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Tip Submitted Successfully</CardTitle>
              <CardDescription>
                Your report has been received and will be reviewed by our safety team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg bg-slate-50 p-4 text-center">
                <p className="text-sm text-slate-600 mb-2">Reference Number</p>
                <p className="text-2xl font-mono font-bold text-slate-900">
                  #{tipNumber}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Save this number for future reference
                </p>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>What happens next:</strong>
                  <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
                    <li>Your tip will be reviewed by our safety team</li>
                    <li>We may investigate and take appropriate action</li>
                    <li>We will not contact you unless you provided contact information</li>
                    <li>For emergencies, please call 911 immediately</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSubmitted(false);
                    setTipNumber('');
                    setFormData({
                      incident_type: '',
                      description: '',
                      location: '',
                      contact_email: '',
                      contact_phone: '',
                      consent: false,
                    });
                    setPhotoFile(null);
                  }}
                >
                  Submit Another Tip
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => router.push('/')}
                >
                  Return Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="mx-auto max-w-3xl py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Submit a Safety Tip</h1>
          <p className="mt-2 text-slate-600">
            Help us keep our community safe by reporting concerns
          </p>
        </div>

        {/* Warning */}
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            <strong className="font-semibold">Important Guidelines:</strong>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
              <li>
                <strong>Do not submit names, faces, or personally identifying information</strong> unless
                you have consent or lawful reason
              </li>
              <li>Avoid vigilante action - let authorities handle investigations</li>
              <li>For immediate emergencies, call 911</li>
              <li>Provide factual information only - no speculation or rumors</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Tip Information</CardTitle>
            <CardDescription>
              All fields except contact information are required
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Incident Type */}
              <div className="space-y-2">
                <Label htmlFor="incident_type">
                  Incident Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.incident_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, incident_type: value })
                  }
                  required
                >
                  <SelectTrigger id="incident_type">
                    <SelectValue placeholder="Select type of incident" />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe what you observed... (e.g., 'Noticed unusual activity near the community center on Tuesday evening')"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  required
                  minLength={20}
                  rows={5}
                  className="resize-none"
                />
                <p className="text-xs text-slate-500">
                  Minimum 20 characters. Be specific but avoid identifying individuals.
                </p>
              </div>

              {/* Photo Upload */}
              <div className="space-y-2">
                <Label htmlFor="photo">Photo Evidence (Optional)</Label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      id="photo"
                      type="file"
                      accept={ALLOWED_FILE_TYPES.join(',')}
                      onChange={handlePhotoChange}
                      className="cursor-pointer"
                    />
                  </div>
                  {photoFile && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Upload className="h-4 w-4" />
                      <span>{photoFile.name}</span>
                    </div>
                  )}
                </div>
                {photoError ? (
                  <p className="text-xs text-red-500">{photoError}</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    JPG, PNG, or WebP. Max 10MB. Blur faces if identifiable.
                  </p>
                )}
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">
                  Approximate Location <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="location"
                    type="text"
                    placeholder="e.g., 'Near Main St and 5th Ave' or 'Community Center parking lot'"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    required
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Provide general area, not exact addresses
                </p>
              </div>

              {/* Optional Contact */}
              <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold">
                    Optional Contact Information
                  </Label>
                </div>
                <p className="text-sm text-slate-600">
                  Provide contact info if you want to be reached for follow-up questions.
                  This is completely optional and anonymous tips are welcome.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact_email">Email</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.contact_email}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact_email: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_phone">Phone</Label>
                    <Input
                      id="contact_phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={formData.contact_phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contact_phone: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Consent */}
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <Checkbox
                    id="consent"
                    checked={formData.consent}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, consent: checked === true })
                    }
                    required
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="consent"
                      className="cursor-pointer text-sm leading-relaxed"
                    >
                      I confirm that I have read and agree to the{' '}
                      <Link
                        href="/privacy"
                        className="text-primary underline hover:no-underline"
                        target="_blank"
                      >
                        Privacy Policy
                      </Link>{' '}
                      and{' '}
                      <Link
                        href="/terms"
                        className="text-primary underline hover:no-underline"
                        target="_blank"
                      >
                        Terms of Service
                      </Link>
                      . I understand that this information will be used to help maintain
                      community safety and may be shared with appropriate authorities.{' '}
                      <span className="text-red-500">*</span>
                    </Label>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push('/')}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || !formData.consent}
                >
                  {loading ? 'Submitting...' : 'Submit Tip'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>
            This tip form is monitored regularly but not in real-time.
          </p>
          <p className="mt-1">
            <strong>For emergencies, call 911 immediately.</strong>
          </p>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs">
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              {' • '}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

