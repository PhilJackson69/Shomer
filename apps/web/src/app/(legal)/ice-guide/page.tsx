/**
 * ICE Activity Alerts - Know Your Rights & Stay Safe
 * Public-facing guide page for ICE alerts
 */

import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'ICE Activity Alerts – Know Your Rights | Shomer',
  description: 'Learn about Shomer ICE alerts and your rights during immigration enforcement encounters.',
};

export default function ICEGuidePage() {
  return (
    <div className="min-h-screen bg-warm-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/" className="text-blue-600 hover:text-blue-700 text-sm mb-2 block">
            ← Back to Shomer
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            ICE Activity Alerts
          </h1>
          <p className="text-xl text-gray-600 mt-2">
            Know Your Rights & Stay Safe
          </p>
        </div>
      </header>

      {/* Language Toggle */}
      <div className="bg-orange-50 border-b border-orange-100">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="text-sm text-orange-900">
            🔶 This guide is available in English and Español
          </div>
          <button className="px-4 py-2 bg-white border border-orange-200 rounded-md text-sm font-medium text-orange-900 hover:bg-orange-50">
            🌐 Español
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* What Shomer ICE Alerts Mean */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            What Shomer ICE Alerts Mean
          </h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-700 mb-4">
              Shomer ICE Alerts are <strong>community-submitted reports</strong> of immigration enforcement activity. Every alert is:
            </p>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                <span><strong>Human-reviewed</strong> by trained moderators before publication</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                <span><strong>Privacy-protected</strong> - no personal information is collected or shared</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                <span><strong>Verified when possible</strong> through trusted community partners</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                <span><strong>Time-limited</strong> - alerts expire after 48 hours</span>
              </li>
            </ul>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-md border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>Important:</strong> These alerts represent <em>reported</em> activity and should be treated as informational. Always prioritize your safety and consult with a legal professional for your specific situation.
              </p>
            </div>
          </div>
        </section>

        {/* Severity Levels */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Understanding Alert Levels
          </h2>
          <div className="space-y-4">
            {/* Rumor */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-3">ℹ️</span>
                <h3 className="text-xl font-semibold text-gray-900">Rumor</h3>
              </div>
              <p className="text-gray-700 ml-11">
                Unconfirmed community report. Use caution and verify with trusted sources before taking action.
              </p>
            </div>

            {/* Verified */}
            <div className="bg-white rounded-lg border border-orange-200 p-6">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-3">⚠️</span>
                <h3 className="text-xl font-semibold text-gray-900">Verified</h3>
              </div>
              <p className="text-gray-700 ml-11">
                Confirmed by a trusted source or multiple independent reports. Higher confidence in accuracy.
              </p>
            </div>

            {/* Active */}
            <div className="bg-white rounded-lg border border-red-200 p-6">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-3">🚨</span>
                <h3 className="text-xl font-semibold text-gray-900">Active</h3>
              </div>
              <p className="text-gray-700 ml-11">
                Current, ongoing activity reported in real-time. Take immediate precautions if in the area.
              </p>
            </div>
          </div>
        </section>

        {/* What to Do When You Receive an Alert */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            What to Do When You Receive an Alert
          </h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <ol className="space-y-4">
              <li className="flex items-start">
                <span className="font-bold text-orange-600 mr-3 text-lg">1.</span>
                <div>
                  <strong className="block mb-1">Stay Calm</strong>
                  <p className="text-gray-700">Take a deep breath. Information gives you power to make smart decisions.</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="font-bold text-orange-600 mr-3 text-lg">2.</span>
                <div>
                  <strong className="block mb-1">Check the Severity</strong>
                  <p className="text-gray-700">Is it a rumor, verified, or active? This helps you assess the situation.</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="font-bold text-orange-600 mr-3 text-lg">3.</span>
                <div>
                  <strong className="block mb-1">Know the Location</strong>
                  <p className="text-gray-700">Check if the reported activity is near you or your routine locations.</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="font-bold text-orange-600 mr-3 text-lg">4.</span>
                <div>
                  <strong className="block mb-1">Make Informed Decisions</strong>
                  <p className="text-gray-700">You might choose to avoid the area, delay travel, or continue with caution.</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="font-bold text-orange-600 mr-3 text-lg">5.</span>
                <div>
                  <strong className="block mb-1">Share Thoughtfully</strong>
                  <p className="text-gray-700">If you share the alert, include the source (Shomer) and severity level.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* Know Your Rights */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Know Your Rights
          </h2>
          <div className="bg-red-50 rounded-lg border border-red-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-red-900 mb-3">
              If Immigration Agents Come to Your Home:
            </h3>
            <ul className="space-y-2 text-red-900">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>You do NOT have to open the door</strong> without a warrant signed by a judge</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>You have the right to remain silent</strong> - you do not have to answer questions</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>Ask to see a warrant</strong> - they can slide it under the door</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>Do not sign anything</strong> without speaking to a lawyer</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>Say: {"\"I want to speak to a lawyer\""}</strong> - then stop talking</span>
              </li>
            </ul>
          </div>

          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              If Stopped in Public or in Your Car:
            </h3>
            <ul className="space-y-2 text-blue-900">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>Stay calm and keep your hands visible</strong></span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>You have the right to remain silent</strong></span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>Do not run or physically resist</strong></span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>Do not give false documents</strong></span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>Ask: {"\"Am I free to go?\""}</strong> If yes, leave calmly</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Legal & Support Hotlines */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Legal & Support Hotlines
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">National Immigration Legal Hotline</h3>
              <a href="tel:1-800-555-0100" className="text-2xl font-bold text-blue-600 hover:text-blue-700">
                1-800-555-0100
              </a>
              <p className="text-sm text-gray-600 mt-2">
                Free legal advice and referrals
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">ACLU Know Your Rights</h3>
              <a href="tel:1-888-555-0200" className="text-2xl font-bold text-blue-600 hover:text-blue-700">
                1-888-555-0200
              </a>
              <p className="text-sm text-gray-600 mt-2">
                Rights violations reporting
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Immigration Advocates Network</h3>
              <a href="tel:1-800-555-0300" className="text-2xl font-bold text-blue-600 hover:text-blue-700">
                1-800-555-0300
              </a>
              <p className="text-sm text-gray-600 mt-2">
                Attorney referrals
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Crisis Text Line</h3>
              <p className="text-lg font-bold text-gray-900">
                Text <span className="text-blue-600">HELP</span> to <span className="text-blue-600">741741</span>
              </p>
              <p className="text-sm text-gray-600 mt-2">
                24/7 crisis support
              </p>
            </div>
          </div>
        </section>

        {/* Opt-In / Opt-Out */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Opt-In / Opt-Out Controls
          </h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">
              How to Receive Alerts
            </h3>
            <p className="text-gray-700 mb-4">
              ICE alerts are <strong>opt-in only</strong>. You must explicitly choose to receive them.
            </p>
            <Link 
              href="/signup"
              className="inline-block px-6 py-3 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 transition-colors"
            >
              Sign Up for ICE Alerts
            </Link>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">
                How to Stop Receiving Alerts
              </h3>
              <p className="text-gray-700 mb-4">
                You can opt out at any time:
              </p>
              <ul className="space-y-2 text-gray-700 mb-4">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Update your preferences in your account settings</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Reply {"\"STOP ICE ALERTS\""} to any SMS alert</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Click {"\"unsubscribe\""} in any email alert</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Contact support: <a href="mailto:community@shomer.app" className="text-blue-600 hover:underline">community@shomer.app</a></span>
                </li>
              </ul>
              <p className="text-sm text-gray-600">
                Opt-out is immediate (within 5 minutes) and does not affect your other Shomer services.
              </p>
            </div>
          </div>
        </section>

        {/* Additional Resources */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Additional Resources
          </h2>
          <p className="text-gray-700 mb-4">
            Additional resources:{" "}
            <Link href="/(legal)/faq" className="text-blue-600 hover:underline">
              Legal FAQ
            </Link>
            {" • "}
            <Link href="/(legal)/media-kit" className="text-blue-600 hover:underline">
              Media Kit
            </Link>
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <a 
              href="/ice-guide/know-your-rights-card.pdf"
              target="_blank"
              className="block bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 transition-colors"
            >
              <h3 className="font-semibold text-gray-900 mb-2">📄 Know Your Rights Card</h3>
              <p className="text-sm text-gray-600">
                Downloadable wallet card with key information (English & Español)
              </p>
            </a>

            <a 
              href="/ice-guide/family-plan.pdf"
              target="_blank"
              className="block bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 transition-colors"
            >
              <h3 className="font-semibold text-gray-900 mb-2">📋 Family Safety Plan</h3>
              <p className="text-sm text-gray-600">
                Template for creating an emergency plan with your family
              </p>
            </a>

            <Link 
              href="/ice-guide/faq"
              className="block bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 transition-colors"
            >
              <h3 className="font-semibold text-gray-900 mb-2">❓ Frequently Asked Questions</h3>
              <p className="text-sm text-gray-600">
                Answers to common questions about ICE alerts
              </p>
            </Link>

            <Link 
              href="/contact"
              className="block bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 transition-colors"
            >
              <h3 className="font-semibold text-gray-900 mb-2">💬 Contact Us</h3>
              <p className="text-sm text-gray-600">
                Questions? We{"'"}re here to help.
              </p>
            </Link>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="bg-orange-50 rounded-lg border border-orange-200 p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Stay Informed. Stay Safe.
          </h2>
          <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
            Join thousands of community members receiving verified ICE activity alerts. 
            Opt-in is free, secure, and you can unsubscribe anytime.
          </p>
          <Link 
            href="/signup"
            className="inline-block px-8 py-4 bg-orange-600 text-white text-lg font-semibold rounded-md hover:bg-orange-700 transition-colors"
          >
            Sign Up for Alerts
          </Link>
          <p className="text-sm text-gray-600 mt-4">
            Protected by Shomer{"'"}s <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-600 mb-4 md:mb-0">
              © 2025 Shomer. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/privacy" className="text-gray-600 hover:text-gray-900">Privacy</Link>
              <Link href="/terms" className="text-gray-600 hover:text-gray-900">Terms</Link>
              <Link href="/docs/ICE_ALERT_POLICY.md" className="text-gray-600 hover:text-gray-900">ICE Alert Policy</Link>
              <Link href="/contact" className="text-gray-600 hover:text-gray-900">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

