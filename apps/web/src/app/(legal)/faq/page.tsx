// apps/web/src/app/(legal)/faq/page.tsx
import Link from "next/link";
import { Metadata } from "next";
import { ChevronDown } from "lucide-react";

export const metadata: Metadata = {
  title: "Legal FAQ • Shomer",
  description:
    "Plain-English answers about Shomer, privacy, ICE alerts, and your rights.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function QA({
  q,
  a,
}: {
  q: string;
  a: React.ReactNode | string;
}) {
  return (
    <details className="group rounded-2xl border p-4 bg-white/50 dark:bg-neutral-900/50">
      <summary className="flex items-center justify-between cursor-pointer list-none">
        <span className="font-medium">{q}</span>
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="pt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
        {a}
      </div>
    </details>
  );
}

export default function FAQPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Legal FAQ</h1>
      <p className="text-neutral-600 dark:text-neutral-300 mb-8">
        This page summarizes key answers from our{" "}
        <Link className="underline" href="/docs/LEGAL_FAQ.md">
          full Legal FAQ document
        </Link>
        . For specific legal questions, consult an attorney.
      </p>

      <Section title="General">
        <QA
          q="Is Shomer legal?"
          a={
            <>
              Yes. Shomer distributes verified, opt-in safety information and
              does not collect or publish personal information about private
              individuals. See our{" "}
              <Link href="/(legal)/privacy" className="underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/(legal)/ice-guide" className="underline">
                ICE Alert Guide
              </Link>
              .
            </>
          }
        />
        <QA
          q="Does Shomer track or identify officers or private people?"
          a="No. We prohibit collecting or distributing names, license plates, or faces. ICE alerts provide location/time windows only and expire after 48 hours."
        />
      </Section>

      <Section title="Privacy & Data">
        <QA
          q="What data is stored and for how long?"
          a="We store only what's necessary. Tip content and metadata follow strict retention windows; ICE alert feed entries auto-expire after 48 hours (with 7-day archive for audit)."
        />
        <QA
          q="Can I request an export or erasure of my personal data?"
          a={
            <>
              Yes—see our Data Subject Request process in{" "}
              <Link href="/docs/LEGAL_FAQ.md" className="underline">
                LEGAL_FAQ.md
              </Link>
              . Operational records (e.g., evidence chain-of-custody) are
              usually excluded by policy and law.
            </>
          }
        />
      </Section>

      <Section title="ICE Alerts">
        <QA
          q="What does each ICE alert level mean?"
          a="Rumor = unconfirmed chatter; Verified = confirmed presence; Active = confirmed enforcement activity. All alerts are human-reviewed and bilingual where possible."
        />
        <QA
          q="How do I opt in or out?"
          a={
            <>
              You control subscriptions in Settings or via the footer links in
              alert emails/SMS. See the{" "}
              <Link href="/(legal)/ice-guide#subscriptions" className="underline">
                ICE Guide subscription section
              </Link>
              .
            </>
          }
        />
      </Section>

      <div className="mt-10 flex gap-3">
        <Link
          href="/(legal)/ice-guide"
          className="rounded-xl px-4 py-2 bg-black text-white dark:bg-white dark:text-black"
        >
          Read the ICE Guide
        </Link>
        <Link
          href="/(legal)/media-kit"
          className="rounded-xl px-4 py-2 border"
        >
          Media Kit
        </Link>
      </div>
    </main>
  );
}


