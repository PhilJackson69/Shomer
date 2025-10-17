// apps/web/src/app/(legal)/media-kit/page.tsx
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Media Kit • Shomer",
  description:
    "Press boilerplate, brand assets, fact sheet, and contact information.",
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-3">{title}</h2>
      <div className="space-y-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
        {children}
      </div>
    </section>
  );
}

export default function MediaKitPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Media Kit</h1>
      <p className="text-neutral-600 dark:text-neutral-300 mb-8">
        For full details see{" "}
        <Link className="underline" href="/docs/MEDIA_KIT.md">
          MEDIA_KIT.md
        </Link>
        . For interview requests:{" "}
        <a className="underline" href="mailto:press@shomer.app">
          press@shomer.app
        </a>
        .
      </p>

      <Block title="Boilerplate (100 words)">
        <p>
          Shomer is a community safety platform that provides verified,
          privacy-preserving alerts for faith and immigrant communities. Alerts
          are human-reviewed, bilingual where possible, and governed by strict
          privacy and retention policies. Shomer does not collect or publish
          personal information about private individuals.           ICE Activity Alerts
          offer calm, factual early warnings with {"\"Know Your Rights\""} resources.
          Learn more at <Link href="/" className="underline">shomer.app</Link>.
        </p>
      </Block>

      <Block title="Brand Assets">
        <ul className="list-disc ml-5">
          <li>
            Logo pack (SVG/PNG):{" "}
            <Link className="underline" href="/assets/brand/shomer-logo-pack.zip">
              download
            </Link>
          </li>
          <li>Primary colors: Shomer Blue #0E4C92, ICE-Alert Orange #F59E0B</li>
          <li>Typography: Inter / system UI</li>
        </ul>
      </Block>

      <Block title="Fact Sheet">
        <ul className="list-disc ml-5">
          <li>Human-in-the-loop moderation and auditability</li>
          <li>No facial recognition; strict data minimization</li>
          <li>ICE alerts expire after 48h; retained 7 days for audit</li>
          <li>Opt-in only; bilingual support</li>
        </ul>
      </Block>

      <div className="mt-10 flex gap-3">
        <Link href="/(legal)/faq" className="rounded-xl px-4 py-2 border">
          Legal FAQ
        </Link>
        <Link href="/(legal)/ice-guide" className="rounded-xl px-4 py-2 bg-black text-white dark:bg-white dark:text-black">
          ICE Guide
        </Link>
      </div>
    </main>
  );
}


