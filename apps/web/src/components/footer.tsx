import Link from 'next/link';
import { Shield } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">Shomer</span>
            </div>
            <p className="text-sm text-slate-600">
              Community safety monitoring and threat detection platform
            </p>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="text-slate-600 transition-colors hover:text-primary"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-slate-600 transition-colors hover:text-primary"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/(legal)/faq"
                  className="text-slate-600 transition-colors hover:text-primary"
                >
                  Legal FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/(legal)/media-kit"
                  className="text-slate-600 transition-colors hover:text-primary"
                >
                  Media Kit
                </Link>
              </li>
              <li>
                <Link
                  href="/(legal)/ice-guide"
                  className="text-slate-600 transition-colors hover:text-primary"
                >
                  ICE Guide
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://github.com/shomer/shomer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-600 transition-colors hover:text-primary"
                >
                  GitHub
                </a>
              </li>
              <li>
                <Link
                  href="/docs/SECURITY.md"
                  className="text-slate-600 transition-colors hover:text-primary"
                >
                  Security
                </Link>
              </li>
              <li>
                <Link
                  href="/docs/GOVERNANCE.md"
                  className="text-slate-600 transition-colors hover:text-primary"
                >
                  Governance
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="mailto:support@shomer.local"
                  className="text-slate-600 transition-colors hover:text-primary"
                >
                  Support
                </a>
              </li>
              <li>
                <a
                  href="mailto:privacy@shomer.local"
                  className="text-slate-600 transition-colors hover:text-primary"
                >
                  Privacy
                </a>
              </li>
              <li>
                <a
                  href="mailto:security@shomer.local"
                  className="text-slate-600 transition-colors hover:text-primary"
                >
                  Security
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-slate-600">
              © {currentYear} Shomer. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span>Made with care for community safety</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

