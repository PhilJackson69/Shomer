"use client";

import { useEffect, useState, useTransition } from "react";
import { apiFetch } from '@/lib/apiFetch';


export default function ThreatLexiconPage() {
  const [yaml, setYaml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await apiFetch("/api/threat-lexicon", { cache: "no-store" });
        const data = await res.json();
        setYaml(data.yaml || "");
      } catch (e: any) {
        setErr("Failed to load lexicon.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = () =>
    startTransition(async () => {
      setErr(null); setMsg(null);
      try {
        const res = await apiFetch("/api/threat-lexicon", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ yaml }),
        });
        if (!res.ok) throw new Error(await res.text());
        setMsg("Saved ✓");
      } catch (e: any) {
        setErr(e?.message || "Save failed");
      }
    });

  const reload = () =>
    startTransition(async () => {
      setErr(null); setMsg(null);
      try {
        const res = await apiFetch("/api/threat-lexicon/reload", { method: "POST" });
        if (!res.ok) throw new Error(await res.text());
        setMsg("Reload signal sent ✓");
      } catch (e: any) {
        setErr(e?.message || "Reload failed");
      }
    });

  return (
    <div className="space-y-4 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Threat Lexicon</h1>
        <div className="flex gap-2">
          <button onClick={save} disabled={pending || loading}
            className="px-3 py-1 rounded-lg border hover:bg-gray-50">Save</button>
          <button onClick={reload} disabled={pending || loading}
            className="px-3 py-1 rounded-lg border hover:bg-gray-50">Validate & Reload</button>
        </div>
      </div>

      {msg && <div className="text-green-700 text-sm">{msg}</div>}
      {err && <div className="text-red-600 text-sm">{err}</div>}

      <textarea
        value={yaml}
        onChange={(e) => setYaml(e.target.value)}
        spellCheck={false}
        className="w-full h-[60vh] font-mono text-sm p-3 border rounded-lg"
        placeholder={`weapons:\n  - bomb\n  - rifle\n...`}
      />
      <p className="text-xs text-gray-500">
        The lexicon is validated (Zod) and persisted to <code>apps/web/config/lexicon.yml</code>. “Validate & Reload” publishes a Redis signal; active workers hot-reload.
      </p>

      <div className="mt-6 space-y-3">
        <h2 className="text-base font-semibold">Test phrase</h2>
        <TestPhraseWidget />
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-0.5 text-xs rounded-full border bg-gray-50">{children}</span>;
}

function TestPhraseWidget() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setErr(null); setRes(null); setLoading(true);
    try {
      const r = await apiFetch("/api/threat-lexicon/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.error || "Eval failed");
      setRes(j.result);
    } catch (e: any) {
      setErr(e?.message || "Eval failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className="w-full font-mono text-sm p-3 border rounded-lg"
        placeholder="Paste a sentence to test scoring, e.g. 'We plan to attack the synagogue on Friday night with a knife.'"
      />
      <div className="flex gap-2">
        <button onClick={run} disabled={loading || !text.trim()} className="px-3 py-1 rounded-lg border hover:bg-gray-50">
          {loading ? "Evaluating…" : "Evaluate"}
        </button>
        <button
          onClick={() => { setText(""); setRes(null); setErr(null); }}
          className="px-3 py-1 rounded-lg border hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {res && (
        <div className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm">Severity:</span>
            <Chip>{res.severity}</Chip>
            <span className="text-sm">Score:</span>
            <Chip>{res.score?.toFixed?.(2)}</Chip>
            {res.excluded && <Chip>Excluded: {res.excluded}</Chip>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip>Lang: {res.lang ?? "—"}</Chip>
            {(res.indicators ?? []).map((k: string) => <Chip key={k}>{k}</Chip>)}
          </div>
          {!!(res.entities?.locations?.length) && (
            <div className="text-xs text-gray-600">
              Locations: {res.entities.locations.join(", ")}
            </div>
          )}
          <div className="text-xs text-gray-600">
            Rationale: {res.rationale}
          </div>
        </div>
      )}
    </div>
  );
}


