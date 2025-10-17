import { readSettings, saveSettings } from "./actions";
import ApiKeysPanel from "./keys";
import WebhooksPanel from "./webhooks";
import WebhookDeliveriesPanel from "./webhook-deliveries";

export default async function SettingsPage() {
  const settings = await readSettings();

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>
      <form action={saveSettings} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Alert threshold (0–100)</label>
          <input name="alertThreshold" defaultValue={settings.alertThreshold} type="number" min={0} max={100} className="border rounded-lg px-3 py-2 w-40" />
        </div>
        <div>
          <label className="block text-sm mb-1">Slack minimum level</label>
          <select name="slackMinLevel" defaultValue={settings.slackMinLevel} className="border rounded-lg px-3 py-2 w-40">
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </div>
        <button className="px-4 py-2 rounded-xl bg-black text-white">Save</button>
      </form>
      <p className="text-xs text-gray-500">DB-stored settings override env defaults for runtime behavior.</p>

      <section>
        <h2 className="text-lg font-semibold mb-2">API Keys</h2>
        <ApiKeysPanel />
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-2">Webhooks</h2>
        <WebhooksPanel />
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-2">Webhook Delivery (dead letters)</h2>
        <WebhookDeliveriesPanel />
      </section>
    </main>
  );
}


