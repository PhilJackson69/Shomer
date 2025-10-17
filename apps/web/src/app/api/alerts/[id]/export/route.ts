import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModerator } from "@/lib/rbac";

const Params = z.object({ id: z.string().min(1) });
const SearchParams = z.object({ format: z.enum(["pdf", "csv"]) });

export async function GET(
  req: Request, 
  { params }: { params: { id: string } }
) {
  const auth = await requireModerator();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 403 });

  const parsed = Params.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
  }

  const url = new URL(req.url);
  const searchParsed = SearchParams.safeParse({
    format: url.searchParams.get("format")
  });
  
  if (!searchParsed.success) {
    return NextResponse.json({ error: "Invalid format. Use 'pdf' or 'csv'" }, { status: 400 });
  }

  try {
    // Mock alert data - replace with actual database queries
    const alert = {
      id: parsed.data.id,
      title: "Potential Threat Detected",
      description: "AI analysis detected potential threatening language in social media post. Content suggests possible violence towards local community center. Multiple risk factors identified including weapon mentions and urgency indicators.",
      severity: "high",
      status: "new",
      source: "Reddit - r/localnews",
      sourceUrl: "https://reddit.com/r/localnews/comments/example",
      createdAt: new Date().toISOString(),
      tags: ["Threat Language", "Weapon Mention", "Community Target"],
      confidence: 0.87,
      riskFactors: [
        "Threat language detected (3 instances)",
        "Weapon mentions (2 instances)",
        "Urgency indicators (1 instance)",
        "Target location mentioned (1 instance)"
      ]
    };

    if (searchParsed.data.format === "pdf") {
      return generatePDF(alert);
    } else {
      return generateCSV(alert);
    }
  } catch (error) {
    console.error("Error exporting alert:", error);
    return NextResponse.json({ error: "Failed to export alert" }, { status: 500 });
  }
}

function generatePDF(alert: any) {
  // Simple PDF generation using basic HTML to PDF conversion
  // In production, you'd use a proper PDF library like Puppeteer or jsPDF
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Alert Report - ${alert.id}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 25px; }
        .label { font-weight: bold; color: #333; }
        .value { margin-top: 5px; }
        .tags { display: flex; flex-wrap: wrap; gap: 5px; }
        .tag { background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .risk-factors { margin-left: 20px; }
        .footer { margin-top: 50px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Alert Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
      </div>
      
      <div class="section">
        <div class="label">Alert ID:</div>
        <div class="value">${alert.id}</div>
      </div>
      
      <div class="section">
        <div class="label">Title:</div>
        <div class="value">${alert.title}</div>
      </div>
      
      <div class="section">
        <div class="label">Description:</div>
        <div class="value">${alert.description}</div>
      </div>
      
      <div class="section">
        <div class="label">Severity:</div>
        <div class="value">${alert.severity.toUpperCase()}</div>
      </div>
      
      <div class="section">
        <div class="label">Status:</div>
        <div class="value">${alert.status.toUpperCase()}</div>
      </div>
      
      <div class="section">
        <div class="label">Source:</div>
        <div class="value">${alert.source}</div>
      </div>
      
      <div class="section">
        <div class="label">Confidence Score:</div>
        <div class="value">${Math.round(alert.confidence * 100)}%</div>
      </div>
      
      <div class="section">
        <div class="label">Tags:</div>
        <div class="tags">
          ${alert.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
      </div>
      
      <div class="section">
        <div class="label">Risk Factors:</div>
        <div class="risk-factors">
          ${alert.riskFactors.map(factor => `<div>• ${factor}</div>`).join('')}
        </div>
      </div>
      
      <div class="section">
        <div class="label">Created At:</div>
        <div class="value">${new Date(alert.createdAt).toLocaleString()}</div>
      </div>
      
      <div class="footer">
        <p>This report was generated automatically by the Shomer Alert System.</p>
        <p>For questions or concerns, contact the system administrator.</p>
      </div>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="alert-${alert.id}.pdf"`
    }
  });
}

function generateCSV(alert: any) {
  const csvData = [
    ["Field", "Value"],
    ["Alert ID", alert.id],
    ["Title", alert.title],
    ["Description", alert.description],
    ["Severity", alert.severity],
    ["Status", alert.status],
    ["Source", alert.source],
    ["Source URL", alert.sourceUrl || ""],
    ["Confidence Score", `${Math.round(alert.confidence * 100)}%`],
    ["Tags", alert.tags.join("; ")],
    ["Risk Factors", alert.riskFactors.join("; ")],
    ["Created At", new Date(alert.createdAt).toLocaleString()],
    ["Generated At", new Date().toLocaleString()]
  ];

  const csvContent = csvData.map(row => 
    row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="alert-${alert.id}.csv"`
    }
  });
}
