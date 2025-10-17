'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, Trash2, Eye, Clock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="mx-auto max-w-5xl py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="mb-4"
          >
            ← Home
          </Button>
          <div className="flex items-center gap-3">
            <Shield className="h-10 w-10 text-blue-600" />
            <div>
              <h1 className="text-4xl font-bold">Privacy Policy</h1>
              <p className="mt-1 text-slate-600">
                Effective Date: January 14, 2025 • Last Updated: January 14, 2025
              </p>
            </div>
          </div>
        </div>

        {/* TL;DR Summary */}
        <Card className="mb-8 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Summary (TL;DR)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>We collect minimal information</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>We delete data regularly (14 days for tips, 1 year for incidents)</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>We never use facial recognition</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>We never sell your data</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>EXIF data is automatically removed from photos</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>You can submit tips anonymously</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>You can request deletion anytime</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>We only share data when legally required or for safety</span>
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-sm font-medium">
                Questions? <a href="mailto:privacy@shomer.local" className="text-blue-600 hover:underline">privacy@shomer.local</a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Key Principles */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Our Commitment to Your Privacy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p className="lead">
              At Shomer, protecting your privacy is fundamental to our mission of keeping communities safe. 
              We believe that effective security does{"'"}t require sacrificing privacy.
            </p>
            <div className="grid md:grid-cols-2 gap-4 not-prose my-6">
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <Lock className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold">Data Minimization</h4>
                  <p className="text-sm text-slate-600">We collect only what we need</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold">Limited Retention</h4>
                  <p className="text-sm text-slate-600">We delete data on a regular schedule</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <Eye className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold">No Facial Recognition</h4>
                  <p className="text-sm text-slate-600">We never use facial recognition technology</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <Shield className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold">Your Control</h4>
                  <p className="text-sm text-slate-600">You decide what to share</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Information We Collect */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>1. Information We Collect</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h3>When You Submit a Tip</h3>
            <p>Our tip submission is designed for <strong>anonymous reporting</strong>. You choose what to share:</p>
            
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <p className="font-semibold text-green-900 mb-2">Required:</p>
              <ul className="mb-0">
                <li>Incident description</li>
                <li>Location (general area is fine)</li>
                <li>Date/time</li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mt-4">
              <p className="font-semibold text-blue-900 mb-2">Optional (you decide):</p>
              <ul className="mb-0">
                <li>Contact information (email or phone)</li>
                <li>Photos or videos</li>
                <li>Your name</li>
              </ul>
            </div>

            <div className="bg-slate-100 border border-slate-300 p-4 rounded-lg mt-4">
              <p className="font-semibold text-slate-900 mb-2">What we automatically record:</p>
              <ul className="mb-0">
                <li>Submission timestamp</li>
                <li>IP address (for spam prevention only, deleted after 7 days)</li>
              </ul>
            </div>

            <h3>Photos and Videos</h3>
            <p>When you upload media:</p>
            <ul>
              <li><strong>EXIF data is automatically removed</strong> (GPS coordinates, camera make/model, timestamps)</li>
              <li><strong>File hash is generated</strong> (to detect duplicates and ensure integrity)</li>
              <li><strong>Original can be preserved</strong> (only if legally required and you consent)</li>
            </ul>

            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <p className="font-semibold text-red-900 mb-2">We never:</p>
              <ul className="mb-0">
                <li>Use facial recognition technology</li>
                <li>Share photos publicly</li>
                <li>Sell or monetize images</li>
              </ul>
            </div>

            <h3>When You Create an Account</h3>
            <p>If you{"'"}re a registered user (staff, moderators, administrators), we collect:</p>
            <ul>
              <li><strong>Email address</strong> (for login and notifications)</li>
              <li><strong>Password</strong> (encrypted - we never see your actual password)</li>
              <li><strong>Name</strong> (optional - you can use a pseudonym)</li>
              <li><strong>Role and permissions</strong> (to control what you can access)</li>
            </ul>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              2. Data Retention & Deletion
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>We believe in data minimization. Here{"'"}s when we automatically delete information:</p>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Data Type</th>
                    <th>Retention Period</th>
                    <th>Exceptions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Anonymous tips</strong></td>
                    <td>14 days</td>
                    <td>Tips marked {"\"escalated\""} or {"\"under investigation\""}</td>
                  </tr>
                  <tr>
                    <td><strong>Incident reports</strong></td>
                    <td>1 year</td>
                    <td>Ongoing investigations, legal holds</td>
                  </tr>
                  <tr>
                    <td><strong>User accounts</strong></td>
                    <td>While active + 90 days after deactivation</td>
                    <td>None</td>
                  </tr>
                  <tr>
                    <td><strong>Audit logs</strong></td>
                    <td>365 days</td>
                    <td>Legal/compliance requirements may extend</td>
                  </tr>
                  <tr>
                    <td><strong>IP addresses</strong></td>
                    <td>7 days</td>
                    <td>Deleted automatically</td>
                  </tr>
                  <tr>
                    <td><strong>Photos (cleaned)</strong></td>
                    <td>30 days</td>
                    <td>Legally required evidence retained longer</td>
                  </tr>
                  <tr>
                    <td><strong>Session data</strong></td>
                    <td>24 hours</td>
                    <td>None</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>Your Right to Delete</h3>
            <p>
              <strong>You can request deletion anytime</strong> by emailing{' '}
              <a href="mailto:privacy@shomer.local" className="text-blue-600 hover:underline">
                privacy@shomer.local
              </a>
            </p>
            <p>
              We will delete your information within <strong>30 days</strong> unless:
            </p>
            <ul>
              <li>We{"'"}re legally required to keep it</li>
              <li>It{"'"}s necessary for an active investigation</li>
              <li>It{"'"}s already been automatically deleted</li>
            </ul>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>3. Security Measures</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h3>How We Protect Your Data</h3>
            <p><strong>Technical safeguards:</strong></p>
            <ul>
              <li>🔐 <strong>Encryption</strong>: All data encrypted in transit (HTTPS/TLS) and at rest (AES-256)</li>
              <li>🔑 <strong>Password security</strong>: Bcrypt hashing with salt (we never see your password)</li>
              <li>🚪 <strong>Access controls</strong>: Role-based permissions, 2-factor authentication available</li>
              <li>📊 <strong>Audit logging</strong>: Every access to sensitive data is logged</li>
              <li>🔄 <strong>Regular backups</strong>: Encrypted and securely stored</li>
            </ul>

            <p><strong>Operational safeguards:</strong></p>
            <ul>
              <li>Background checks for staff with data access</li>
              <li>Mandatory privacy training</li>
              <li>Incident response plan</li>
              <li>Regular security audits</li>
              <li>Penetration testing</li>
            </ul>

            <p>
              For complete security details, see our{' '}
              <a href="/docs/SECURITY.md" className="text-blue-600 hover:underline">
                Security Policy
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Your Rights */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>4. Your Rights and Choices</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of your information</li>
              <li><strong>Correct:</strong> Fix inaccurate information</li>
              <li><strong>Delete:</strong> Request deletion (with exceptions noted above)</li>
              <li><strong>Object:</strong> Opt out of non-essential processing</li>
              <li><strong>Portability:</strong> Download your data in common formats</li>
              <li><strong>Withdraw consent:</strong> Unsubscribe from communications</li>
            </ul>

            <p className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <strong>To exercise these rights:</strong> Email{' '}
              <a href="mailto:privacy@shomer.local" className="text-blue-600 hover:underline">
                privacy@shomer.local
              </a>
            </p>

            <h3>Anonymous Use</h3>
            <p><strong>You can use most features anonymously:</strong></p>
            <ul>
              <li>Submit tips without providing contact info</li>
              <li>View public safety information</li>
              <li>Attend community events</li>
            </ul>

            <p><strong>Registration required only for:</strong></p>
            <ul>
              <li>Creating incidents (moderators)</li>
              <li>Sending alerts (moderators)</li>
              <li>Administrative functions (admins)</li>
            </ul>
          </CardContent>
        </Card>

        {/* Sharing */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>5. Sharing and Disclosure</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h3>Who Can See Your Information</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Information</th>
                    <th>Public</th>
                    <th>Registered Users</th>
                    <th>Moderators</th>
                    <th>Admins</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Anonymous tips</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>✅</td>
                    <td>✅</td>
                  </tr>
                  <tr>
                    <td>Contact info from tips</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>✅ (if provided)</td>
                    <td>✅</td>
                  </tr>
                  <tr>
                    <td>Incident reports</td>
                    <td>❌</td>
                    <td>✅ (read-only)</td>
                    <td>✅</td>
                    <td>✅</td>
                  </tr>
                  <tr>
                    <td>User accounts</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>✅</td>
                  </tr>
                  <tr>
                    <td>Audit logs</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>❌</td>
                    <td>✅</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>We may share information with:</h3>
            
            <h4>Law Enforcement:</h4>
            <ul>
              <li>With valid legal process (subpoena, warrant)</li>
              <li>For imminent safety threats</li>
              <li>We will notify you unless legally prohibited</li>
            </ul>

            <h4>Safety Partners:</h4>
            <ul>
              <li>Local security teams (with your organization{"'"}s approval)</li>
              <li>Emergency services (when necessary)</li>
              <li>Only the minimum information needed</li>
            </ul>

            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <p className="font-semibold text-red-900 mb-2">We will NEVER share with:</p>
              <ul className="mb-0">
                <li>Data brokers</li>
                <li>Advertisers</li>
                <li>Social media platforms</li>
                <li>Anyone for commercial purposes</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              6. Contact Us
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p><strong>Questions about privacy?</strong> We{"'"}re here to help.</p>
            
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="mb-2"><strong>Privacy Team:</strong></p>
              <ul className="mb-0">
                <li>
                  <strong>Email:</strong>{' '}
                  <a href="mailto:privacy@shomer.local" className="text-blue-600 hover:underline">
                    privacy@shomer.local
                  </a>
                </li>
                <li><strong>Response time:</strong> Within 48 hours</li>
                <li><strong>Mailing address:</strong> [Your Organization Address]</li>
              </ul>
            </div>

            <p className="mt-4"><strong>For specific requests:</strong></p>
            <ul>
              <li>
                <strong>Data access/deletion:</strong>{' '}
                <a href="mailto:privacy@shomer.local" className="text-blue-600 hover:underline">
                  privacy@shomer.local
                </a>
              </li>
              <li>
                <strong>Security concerns:</strong>{' '}
                <a href="mailto:security@shomer.local" className="text-blue-600 hover:underline">
                  security@shomer.local
                </a>
              </li>
              <li>
                <strong>General questions:</strong>{' '}
                <a href="mailto:support@shomer.local" className="text-blue-600 hover:underline">
                  support@shomer.local
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Transparency */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>7. Transparency</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h3>Open Source</h3>
            <p>
              <strong>Our code is open source.</strong> You can review:
            </p>
            <ul>
              <li>How we handle data: <a href="https://github.com/[your-org]/shomer" className="text-blue-600 hover:underline">GitHub Repository</a></li>
              <li>Security measures: See <code>docs/SECURITY.md</code></li>
              <li>Privacy implementation: See source code</li>
            </ul>

            <h3>Transparency Report</h3>
            <p>
              We publish an annual transparency report covering:
            </p>
            <ul>
              <li>Number of law enforcement requests</li>
              <li>Data breaches (if any)</li>
              <li>Changes to practices</li>
              <li>Aggregate usage statistics</li>
            </ul>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-slate-700 italic">
            This privacy policy is designed for community safety. We believe effective security and strong privacy can coexist.
          </p>
          <p className="mt-4 text-sm text-slate-600">
            <strong>This policy is written in plain English intentionally.</strong> If anything is unclear, please ask.
          </p>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex gap-4 justify-center">
          <Button variant="outline" onClick={() => router.push('/terms')}>
            Terms of Service →
          </Button>
          <Button onClick={() => router.push('/')}>
            Return Home
          </Button>
        </div>
      </div>
    </div>
  );
}

