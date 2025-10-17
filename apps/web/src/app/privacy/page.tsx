'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="mx-auto max-w-4xl py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            ← Back
          </Button>
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
          </div>
          <p className="mt-2 text-slate-600">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Information We Collect</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h3>Tip Submissions</h3>
            <p>
              When you submit a safety tip, we collect:
            </p>
            <ul>
              <li>Incident type and description</li>
              <li>Location information (approximate)</li>
              <li>Optional photo evidence</li>
              <li>Optional contact information (email/phone)</li>
              <li>Submission timestamp and IP address (for security)</li>
            </ul>

            <h3>How We Use Your Information</h3>
            <p>
              Information you provide is used to:
            </p>
            <ul>
              <li>Investigate and respond to safety concerns</li>
              <li>Identify patterns and trends in community safety</li>
              <li>Contact you for follow-up (if contact info provided)</li>
              <li>Share with law enforcement when appropriate</li>
              <li>Improve our safety monitoring systems</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Data Protection</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h3>Security Measures</h3>
            <p>
              We implement industry-standard security measures including:
            </p>
            <ul>
              <li>Encrypted data transmission (HTTPS/TLS)</li>
              <li>Secure database storage</li>
              <li>Access controls and authentication</li>
              <li>Regular security audits</li>
              <li>Data backup and recovery procedures</li>
            </ul>

            <h3>Data Retention</h3>
            <p>
              Tips and related information are retained:
            </p>
            <ul>
              <li>Active investigations: Duration of investigation + 1 year</li>
              <li>Closed cases: 5 years for pattern analysis</li>
              <li>Photos: Same as tip retention period</li>
              <li>Contact information: Deleted upon request or after retention period</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Rights</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h3>Privacy Rights</h3>
            <p>
              You have the right to:
            </p>
            <ul>
              <li>Submit tips anonymously (contact info optional)</li>
              <li>Request deletion of your contact information</li>
              <li>Know how your information is being used</li>
              <li>Opt out of follow-up contact</li>
            </ul>

            <h3>Third-Party Sharing</h3>
            <p>
              We may share information with:
            </p>
            <ul>
              <li>Law enforcement agencies (when legally required or appropriate)</li>
              <li>Emergency services (for immediate threats)</li>
              <li>Community safety partners (anonymized data only)</li>
            </ul>
            <p>
              We do <strong>not</strong> sell or share your information for marketing purposes.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Anonymous Submissions</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              You can submit tips completely anonymously by:
            </p>
            <ul>
              <li>Not providing contact information</li>
              <li>Using a VPN or Tor browser (optional)</li>
              <li>Not including identifiable information in descriptions</li>
            </ul>
            <p>
              <strong>Note:</strong> Anonymous tips are still valuable and will be investigated,
              but we cannot contact you for follow-up questions.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Guidelines for Responsible Reporting</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h3>Do:</h3>
            <ul>
              <li>Report suspicious or concerning behavior</li>
              <li>Provide factual, objective information</li>
              <li>Include relevant context and timing</li>
              <li>Blur faces in photos when possible</li>
            </ul>

            <h3>Don{"\'"}t:</h3>
            <ul>
              <li>Submit false or fabricated reports</li>
              <li>Include personal information of individuals without consent</li>
              <li>Use this platform for harassment or retaliation</li>
              <li>Take vigilante action based on suspicions</li>
              <li>Share unverified rumors or speculation</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cookies and Tracking</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              The tip submission form uses minimal tracking:
            </p>
            <ul>
              <li>Essential cookies for form functionality</li>
              <li>No advertising or marketing cookies</li>
              <li>No cross-site tracking</li>
              <li>Session data cleared after submission</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Us</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              For questions about this privacy policy or to exercise your privacy rights:
            </p>
            <ul>
              <li>Email: privacy@shomer.app</li>
              <li>Phone: 1-800-SHOMER-1</li>
              <li>Mail: Shomer Privacy Team, [Address]</li>
            </ul>
            <p>
              <strong>For emergencies, always call 911 first.</strong>
            </p>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Button onClick={() => router.back()}>
            Return to Tip Form
          </Button>
        </div>
      </div>
    </div>
  );
}

