import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { areQueuesAvailable } from "../queues";
import { beat } from "@/lib/threat-detection/heartbeat";
import { externalFetch as fetch } from '@/lib/external-fetch';


// Initialize Redis connection
const connection = process.env.REDIS_URL ? new (require("ioredis"))(process.env.REDIS_URL) : null;

// Slack webhook URL for alerts
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

interface SlackMessage {
  text: string;
  blocks: Array<{
    type: string;
    text?: {
      type: string;
      text: string;
    };
  }>;
}

function createSlackMessage(signal: any): SlackMessage {
  const severityEmoji = {
    LOW: "🟡",
    MEDIUM: "🟠", 
    HIGH: "🔴",
    CRITICAL: "🚨"
  };

  const emoji = severityEmoji[signal.severity as keyof typeof severityEmoji] || "🔴";

  return {
    text: `${emoji} *Potential Threat Detected* — *${signal.severity}* (score ${signal.score.toFixed(2)})`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Severity:* ${signal.severity} (score ${signal.score.toFixed(2)})\n*Source:* ${signal.raw.url}\n*Detected:* ${new Date(signal.createdAt).toLocaleString()}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Title:* ${signal.raw.title || "(no title)"}\n*Author:* ${signal.raw.author || "unknown"}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Indicators:* ${signal.indicators || "none"}\n*Language:* ${signal.lang || "unknown"}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Rationale:* ${signal.rationale || "No rationale provided"}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Content Excerpt:*\n\`\`\`${signal.raw.content.slice(0, 800)}${signal.raw.content.length > 800 ? '...' : ''}\`\`\``
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Full Details"
            },
            url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/threat-signals/${signal.id}`,
            style: "primary"
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Mark as False Positive"
            },
            action_id: "false_positive",
            style: "danger"
          }
        ]
      }
    ]
  };
}

async function sendSlackAlert(signal: any): Promise<{ success: boolean; response?: any; error?: string }> {
  if (!SLACK_WEBHOOK_URL) {
    return { success: false, error: "Slack webhook URL not configured" };
  }

  try {
    const message = createSlackMessage(signal);
    
    const response = await externalFetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const responseText = await response.text();
    
    if (response.ok) {
      return { success: true, response: { status: response.status, body: responseText } };
    } else {
      return { success: false, error: `HTTP ${response.status}: ${responseText}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export const alertWorker = new Worker(
  "alert",
  async (job) => {
    try {
      const { signalId } = job.data as { signalId: string };
      
      console.log(`[Alert Worker] Processing signalId: ${signalId}`);

      // Find the threat signal with raw data
      const signal = await prisma.threatSignal.findUnique({
        where: { id: signalId },
        include: { raw: true },
      });

      if (!signal) {
        console.error(`[Alert Worker] Threat signal not found: ${signalId}`);
        return;
      }

      // Respect snooze window
      if ((signal as any).snoozeUntil && new Date((signal as any).snoozeUntil) > new Date()) {
        console.log(`[Alert Worker] Signal ${signalId} snoozed until ${(signal as any).snoozeUntil}, skipping alert`);
        return;
      }

      // Check if already alerted to prevent duplicates
      const recent = await prisma.alertEvent.findFirst({
        where: {
          signalId: signal.id,
          deliveredAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
          success: true,
        },
      });
      if (recent) {
        console.log(`[Alert Worker] Recent successful alert exists for ${signalId}, skipping`);
        return;
      }
      const existingAlert = await prisma.alertEvent.findFirst({
        where: { signalId, channel: "slack:#shomer-alerts" },
      });

      if (existingAlert && existingAlert.success) {
        console.log(`[Alert Worker] Signal ${signalId} already successfully alerted`);
        return;
      }

      // Global alert kill-switch
      if (process.env.TD_ALERTS_ENABLED === "false") {
        console.log(`[Alert Worker] Alerts disabled via TD_ALERTS_ENABLED=false`);
        return;
      }

      // Send Slack alert
      console.log(`[Alert Worker] Sending Slack alert for signal ${signalId}`);
      const alertResult = await sendSlackAlert(signal);

      // Record the alert event
      const alertEvent = await prisma.alertEvent.create({
        data: {
          signalId: signal.id,
          channel: "slack:#shomer-alerts",
          deliveredAt: new Date(),
          success: alertResult.success,
          response: alertResult.success ? JSON.stringify(alertResult.response) : JSON.stringify({ error: alertResult.error }),
        },
      });

      if (alertResult.success) {
        // Update signal status to alerted
        await prisma.threatSignal.update({
          where: { id: signal.id },
          data: { status: "ALERTED", updatedAt: new Date() },
        });
        
        console.log(`[Alert Worker] Successfully sent alert for signal ${signalId} (alert event: ${alertEvent.id})`);
      } else {
        console.error(`[Alert Worker] Failed to send alert for signal ${signalId}: ${alertResult.error}`);
        throw new Error(`Alert delivery failed: ${alertResult.error}`);
      }

      // Heartbeat
      await beat("alert");

    } catch (error) {
      console.error(`[Alert Worker] Error processing job:`, error);
      throw error; // Re-throw to trigger retry mechanism
    }
  },
  { 
    connection: connection || undefined,
    concurrency: 2, // Process up to 2 alert jobs concurrently
    removeOnComplete: 10,
    removeOnFail: 5,
  }
);

// Handle worker events
alertWorker.on('completed', (job) => {
  console.log(`[Alert Worker] Job ${job.id} completed successfully`);
});

alertWorker.on('failed', (job, err) => {
  console.error(`[Alert Worker] Job ${job?.id} failed:`, err.message);
});

alertWorker.on('error', (err) => {
  console.error(`[Alert Worker] Worker error:`, err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Alert Worker] Received SIGTERM, closing worker...');
  await alertWorker.close();
});

process.on('SIGINT', async () => {
  console.log('[Alert Worker] Received SIGINT, closing worker...');
  await alertWorker.close();
});

console.log(`[Alert Worker] Started ${areQueuesAvailable() ? 'with Redis' : 'without Redis (disabled)'}`);
console.log(`[Alert Worker] Slack webhook: ${SLACK_WEBHOOK_URL ? 'configured' : 'not configured'}`);
