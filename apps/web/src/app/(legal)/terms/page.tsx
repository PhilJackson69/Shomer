'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsOfServicePage() {
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
            <FileText className="h-10 w-10 text-slate-700" />
            <div>
              <h1 className="text-4xl font-bold">Terms of Service</h1>
              <p className="mt-1 text-slate-600">
                Effective Date: January 14, 2025 • Last Updated: January 14, 2025
              </p>
            </div>
          </div>
        </div>

        {/* Quick Summary */}
        <Card className="mb-8 border-slate-300 bg-slate-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Quick Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p className="lead">
              <strong>Please read these terms carefully.</strong> By using Shomer, you agree to:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Submit only truthful, factual information</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Use Shomer for community safety purposes only</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Respect others{"'"} privacy and rights</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <span>Never submit false reports or use the platform for harassment</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <span>Never attempt to abuse, hack, or disrupt the platform</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* 1. Acceptance of Terms */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>1. Acceptance of Terms</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              Welcome to Shomer. By accessing or using our platform, you agree to be bound by these Terms of Service 
              ({"\"Terms\""}), our <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>, and all 
              applicable laws and regulations.
            </p>
            
            <p>
              <strong>If you do not agree to these terms, do not use Shomer.</strong>
            </p>

            <h3>Who May Use Shomer</h3>
            <ul>
              <li><strong>Age requirement:</strong> You must be at least 13 years old to use Shomer</li>
              <li><strong>Minors (under 18):</strong> Should have parent/guardian permission before submitting personal information</li>
              <li><strong>Organization members:</strong> Must comply with your organization{"'"}s policies</li>
            </ul>

            <h3>Changes to Terms</h3>
            <p>
              We may update these Terms from time to time. We will notify registered users via email at least 30 days 
              before changes take effect. Continued use of Shomer after changes constitutes acceptance of the new terms.
            </p>
          </CardContent>
        </Card>

        {/* 2. Permitted Use */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>2. Permitted Use</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h3>Shomer is designed for:</h3>
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <ul className="mb-0">
                <li>Reporting legitimate safety concerns and suspicious activity</li>
                <li>Coordinating community security efforts</li>
                <li>Sharing safety information with authorized personnel</li>
                <li>Documenting incidents for investigation and prevention</li>
                <li>Sending emergency alerts to community members</li>
              </ul>
            </div>

            <h3>Acceptable Use Guidelines</h3>
            <p>When using Shomer, you agree to:</p>
            <ul>
              <li>✅ Provide truthful, accurate information</li>
              <li>✅ Respect the privacy and dignity of others</li>
              <li>✅ Use the platform for its intended safety purpose</li>
              <li>✅ Follow all applicable laws and regulations</li>
              <li>✅ Cooperate with investigations when appropriate</li>
              <li>✅ Protect your account credentials (if registered)</li>
            </ul>
          </CardContent>
        </Card>

        {/* 3. Prohibited Conduct */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              3. Prohibited Conduct
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p><strong>You may NOT use Shomer to:</strong></p>
            
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <h4 className="text-red-900 mt-0">Prohibited Activities:</h4>
              <ul className="mb-0">
                <li>❌ Submit false, misleading, or fabricated reports</li>
                <li>❌ Harass, threaten, or intimidate individuals</li>
                <li>❌ Discriminate based on race, religion, gender, or other protected characteristics</li>
                <li>❌ Violate anyone{"'"}s privacy rights</li>
                <li>❌ Share personally identifiable information without consent</li>
                <li>❌ Use the platform for vigilante justice or retaliation</li>
                <li>❌ Spread rumors, gossip, or unverified information</li>
                <li>❌ Impersonate others or misrepresent your identity</li>
                <li>❌ Attempt to hack, compromise, or disrupt the platform</li>
                <li>❌ Upload malware, viruses, or harmful code</li>
                <li>❌ Scrape, data mine, or extract data without authorization</li>
                <li>❌ Interfere with others{"'"} use of the platform</li>
                <li>❌ Use automated systems (bots) without permission</li>
                <li>❌ Circumvent security measures or access restrictions</li>
                <li>❌ Use the platform for commercial or marketing purposes</li>
              </ul>
            </div>

            <h3>Consequences of Violations</h3>
            <p>Violations of these terms may result in:</p>
            <ul>
              <li>Warning and account review</li>
              <li>Temporary suspension of access</li>
              <li>Permanent ban from the platform</li>
              <li>Reporting to law enforcement (for illegal activity)</li>
              <li>Legal action for damages</li>
            </ul>
          </CardContent>
        </Card>

        {/* 4. User Responsibilities */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>4. User Responsibilities</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h3>Tip Submitters</h3>
            <p>When submitting tips, you are responsible for:</p>
            <ul>
              <li><strong>Accuracy:</strong> Ensure information is truthful and factual</li>
              <li><strong>Context:</strong> Provide sufficient detail for proper investigation</li>
              <li><strong>Timeliness:</strong> Report safety threats promptly</li>
              <li><strong>Privacy:</strong> Blur faces in photos when possible; don{"'"}t photograph minors unnecessarily</li>
              <li><strong>Good faith:</strong> Act with genuine concern for safety, not malice</li>
            </ul>

            <h3>Registered Users (Moderators/Admins)</h3>
            <p>If you have an account, you must:</p>
            <ul>
              <li><strong>Secure your account:</strong> Use strong passwords, enable 2FA</li>
              <li><strong>Maintain confidentiality:</strong> Don{"'"}t share sensitive information inappropriately</li>
              <li><strong>Follow procedures:</strong> Adhere to organizational policies and training</li>
              <li><strong>Exercise judgment:</strong> Make decisions fairly and without bias</li>
              <li><strong>Log out:</strong> Especially on shared devices</li>
              <li><strong>Report issues:</strong> Notify administrators of suspicious activity or concerns</li>
            </ul>

            <h3>Emergencies</h3>
            <div className="bg-amber-50 border border-amber-300 p-4 rounded-lg">
              <p className="font-bold text-amber-900 mb-2">⚠️ IMPORTANT:</p>
              <p className="mb-0">
                <strong>For immediate emergencies or life-threatening situations, ALWAYS call 911 first.</strong> 
                Shomer is a supplementary tool, not a replacement for emergency services.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 5. Content and Intellectual Property */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>5. Content and Intellectual Property</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h3>Your Content</h3>
            <p>
              When you submit content to Shomer (tips, photos, incident reports), you:
            </p>
            <ul>
              <li><strong>Retain ownership</strong> of your content</li>
              <li><strong>Grant us a license</strong> to use, store, and process your content for the purpose of operating the platform</li>
              <li><strong>Warrant</strong> that you have the right to submit the content</li>
              <li><strong>Warrant</strong> that the content doesn{"'"}t violate laws or others{"'"} rights</li>
            </ul>

            <p>
              <strong>License scope:</strong> The license you grant us is limited to:
            </p>
            <ul>
              <li>Operating and improving the platform</li>
              <li>Investigating and responding to safety concerns</li>
              <li>Complying with legal obligations</li>
              <li>Aggregating data for safety analysis (anonymized)</li>
            </ul>

            <p>
              We will NOT use your content for advertising, marketing, or any purpose unrelated to community safety.
            </p>

            <h3>Our Content</h3>
            <p>
              Shomer{"'"}s platform, including its design, code, features, and branding, is owned by us and protected by 
              copyright, trademark, and other intellectual property laws.
            </p>

            <p>
              <strong>Open Source:</strong> Portions of Shomer are open source software. See our{' '}
              <a href="https://github.com/[your-org]/shomer" className="text-blue-600 hover:underline">
                GitHub repository
              </a> for license details.
            </p>
          </CardContent>
        </Card>

        {/* 6. Disclaimer of Warranties */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>6. Disclaimer of Warranties</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <div className="bg-slate-100 border border-slate-300 p-4 rounded-lg">
              <p>
                <strong>SHOMER IS PROVIDED {"\"AS IS\""} AND {"\"AS AVAILABLE\""} WITHOUT WARRANTIES OF ANY KIND.</strong>
              </p>
              
              <p>We make no warranties that:</p>
              <ul>
                <li>The platform will be error-free or uninterrupted</li>
                <li>All security threats will be detected or prevented</li>
                <li>User-submitted information is accurate or reliable</li>
                <li>The platform will meet your specific needs</li>
                <li>Data will never be lost or corrupted</li>
              </ul>

              <p>
                <strong>We are not responsible for:</strong>
              </p>
              <ul className="mb-0">
                <li>The accuracy or reliability of user-submitted tips and reports</li>
                <li>Actions taken or not taken based on information in Shomer</li>
                <li>Third-party services or integrations</li>
                <li>Internet connectivity or device issues</li>
              </ul>
            </div>

            <p className="mt-4">
              <strong>Use at your own risk.</strong> While we strive for excellence, we cannot guarantee perfection. 
              Always use professional judgment and verify information before taking action.
            </p>
          </CardContent>
        </Card>

        {/* 7. Limitation of Liability */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>7. Limitation of Liability</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <div className="bg-slate-100 border border-slate-300 p-4 rounded-lg">
              <p>
                <strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong>
              </p>
              
              <p>
                Shomer and its operators, employees, and affiliates shall NOT be liable for any indirect, incidental, 
                special, consequential, or punitive damages, including but not limited to:
              </p>
              <ul>
                <li>Loss of profits, revenue, or data</li>
                <li>Personal injury or property damage</li>
                <li>Business interruption</li>
                <li>Loss of privacy or security</li>
                <li>Failure to detect or prevent threats</li>
                <li>Reliance on user-submitted information</li>
              </ul>

              <p>
                <strong>Our total liability to you for any claims arising from these Terms or your use of Shomer 
                shall not exceed $100 or the amount you paid us in the past 12 months, whichever is greater.</strong>
              </p>
            </div>

            <p className="mt-4">
              Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability. 
              In such jurisdictions, our liability is limited to the greatest extent permitted by law.
            </p>
          </CardContent>
        </Card>

        {/* 8. Indemnification */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>8. Indemnification</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              You agree to indemnify, defend, and hold harmless Shomer and its operators from any claims, damages, 
              losses, or expenses (including legal fees) arising from:
            </p>
            <ul>
              <li>Your use or misuse of the platform</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any laws or regulations</li>
              <li>Your violation of others{"'"} rights (privacy, intellectual property, etc.)</li>
              <li>Content you submit to the platform</li>
              <li>Your negligent or wrongful conduct</li>
            </ul>

            <p>
              <strong>Example:</strong> If you submit a false report that harms someone{"'"}s reputation, and they sue us, 
              you agree to cover our legal costs and any damages awarded.
            </p>
          </CardContent>
        </Card>

        {/* 9. Data and Privacy */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>9. Data and Privacy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              Your privacy is important to us. Our{' '}
              <a href="/privacy" className="text-blue-600 hover:underline font-semibold">
                Privacy Policy
              </a>{' '}
              explains how we collect, use, and protect your information.
            </p>

            <h3>Key Points:</h3>
            <ul>
              <li>We collect minimal information necessary for the platform to function</li>
              <li>Anonymous tip submission is available (no contact info required)</li>
              <li>EXIF data is automatically removed from photos</li>
              <li>We never use facial recognition</li>
              <li>Data is automatically deleted according to retention schedules</li>
              <li>We never sell your data</li>
            </ul>

            <p>
              By using Shomer, you consent to our data practices as described in the Privacy Policy.
            </p>
          </CardContent>
        </Card>

        {/* 10. Governance and Oversight */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>10. Governance and Oversight</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              Shomer operates under a structured governance framework with independent oversight. See our{' '}
              <a href="/docs/GOVERNANCE.md" className="text-blue-600 hover:underline">
                Governance Policy
              </a>{' '}
              for details.
            </p>

            <h3>Key Governance Principles:</h3>
            <ul>
              <li><strong>Human-in-the-loop:</strong> No fully automated decisions for critical actions</li>
              <li><strong>Oversight Board:</strong> Independent board reviews policies and incidents</li>
              <li><strong>Transparency:</strong> Quarterly transparency reports published</li>
              <li><strong>Accountability:</strong> All actions logged and auditable</li>
              <li><strong>Appeals:</strong> You can appeal any decision affecting you</li>
            </ul>

            <h3>Appeals Process</h3>
            <p>
              If you disagree with a decision (account suspension, content removal, etc.), you can appeal by emailing{' '}
              <a href="mailto:appeals@shomer.local" className="text-blue-600 hover:underline">
                appeals@shomer.local
              </a>
            </p>

            <p>
              Appeals are reviewed by a different moderator and typically resolved within 7 business days.
            </p>
          </CardContent>
        </Card>

        {/* 11. Termination */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>11. Termination</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h3>We May Terminate Your Access If:</h3>
            <ul>
              <li>You violate these Terms</li>
              <li>You engage in prohibited conduct</li>
              <li>Your account is inactive for extended periods</li>
              <li>Required by law or regulatory authorities</li>
              <li>Continuing to provide service creates legal or safety risks</li>
            </ul>

            <p>
              <strong>We will attempt to provide notice before termination</strong> except in cases of severe violations 
              or emergency situations.
            </p>

            <h3>You May Terminate Your Account:</h3>
            <p>
              You can request account deletion at any time by emailing{' '}
              <a href="mailto:privacy@shomer.local" className="text-blue-600 hover:underline">
                privacy@shomer.local
              </a>
            </p>

            <p>
              We will delete your account and associated data within 30 days, subject to legal retention requirements.
            </p>

            <h3>Effect of Termination:</h3>
            <ul>
              <li>Your access to the platform will cease</li>
              <li>Your account data will be deleted per retention policies</li>
              <li>Previously submitted tips may be retained if part of active investigations</li>
              <li>Provisions of these Terms that should survive (liability, indemnification) remain in effect</li>
            </ul>
          </CardContent>
        </Card>

        {/* 12. Dispute Resolution */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>12. Dispute Resolution</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h3>Informal Resolution</h3>
            <p>
              If you have a dispute with us, please contact us first at{' '}
              <a href="mailto:legal@shomer.local" className="text-blue-600 hover:underline">
                legal@shomer.local
              </a>{' '}
              to attempt informal resolution.
            </p>

            <h3>Arbitration (If Applicable)</h3>
            <p>
              <em>
                [Your organization should consult legal counsel to determine if arbitration clauses are appropriate 
                and comply with local laws]
              </em>
            </p>

            <h3>Governing Law</h3>
            <p>
              These Terms are governed by the laws of [Your State/Country], without regard to conflict of law principles.
            </p>

            <h3>Venue</h3>
            <p>
              Any legal action or proceeding related to these Terms shall be brought exclusively in the courts located 
              in [Your Jurisdiction].
            </p>
          </CardContent>
        </Card>

        {/* 13. General Provisions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>13. General Provisions</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h3>Entire Agreement</h3>
            <p>
              These Terms, together with our Privacy Policy and Governance Policy, constitute the entire agreement 
              between you and Shomer.
            </p>

            <h3>Severability</h3>
            <p>
              If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions 
              will remain in full force and effect.
            </p>

            <h3>Waiver</h3>
            <p>
              Our failure to enforce any provision of these Terms does not constitute a waiver of that provision.
            </p>

            <h3>Assignment</h3>
            <p>
              You may not assign or transfer your rights or obligations under these Terms. We may assign our rights 
              and obligations to a successor entity.
            </p>

            <h3>Force Majeure</h3>
            <p>
              We are not liable for delays or failures in performance due to causes beyond our reasonable control 
              (natural disasters, wars, pandemics, internet outages, etc.).
            </p>

            <h3>Contact for Legal Notices</h3>
            <p>
              Legal notices should be sent to:{' '}
              <a href="mailto:legal@shomer.local" className="text-blue-600 hover:underline">
                legal@shomer.local
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>14. Questions About These Terms</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              If you have questions about these Terms of Service, please contact us:
            </p>
            
            <ul>
              <li>
                <strong>General questions:</strong>{' '}
                <a href="mailto:support@shomer.local" className="text-blue-600 hover:underline">
                  support@shomer.local
                </a>
              </li>
              <li>
                <strong>Legal questions:</strong>{' '}
                <a href="mailto:legal@shomer.local" className="text-blue-600 hover:underline">
                  legal@shomer.local
                </a>
              </li>
              <li>
                <strong>Privacy questions:</strong>{' '}
                <a href="mailto:privacy@shomer.local" className="text-blue-600 hover:underline">
                  privacy@shomer.local
                </a>
              </li>
            </ul>

            <p>
              <strong>We typically respond within 48 hours.</strong>
            </p>
          </CardContent>
        </Card>

        {/* Version History */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Version History</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Date</th>
                  <th>Changes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1.0</td>
                  <td>January 14, 2025</td>
                  <td>Initial Terms of Service</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 p-6 bg-slate-100 border border-slate-300 rounded-lg">
          <p className="text-slate-700 font-medium mb-2">
            By using Shomer, you acknowledge that you have read, understood, and agree to these Terms of Service.
          </p>
          <p className="text-sm text-slate-600">
            Last reviewed: January 14, 2025
          </p>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex gap-4 justify-center flex-wrap">
          <Button variant="outline" onClick={() => router.push('/privacy')}>
            ← Privacy Policy
          </Button>
          <Button variant="outline" onClick={() => router.push('/docs/GOVERNANCE.md')}>
            Governance Policy
          </Button>
          <Button onClick={() => router.push('/')}>
            Return Home
          </Button>
        </div>
      </div>
    </div>
  );
}

