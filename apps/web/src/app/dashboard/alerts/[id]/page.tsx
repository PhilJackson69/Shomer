"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Clock, User, ExternalLink, Download, Tag, History } from "lucide-react";
import { AlertTagManager } from "@/components/AlertTagManager";
import { format } from "date-fns";
import { toast } from "sonner";
import { apiFetch } from '@/lib/apiFetch';


interface Alert {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "new" | "verified" | "dismissed";
  source: string;
  sourceUrl?: string;
  createdAt: string;
  verifiedAt?: string;
  dismissedAt?: string;
  verifiedBy?: string;
  dismissedBy?: string;
  tags: string[];
  confidence: number;
  riskFactors: string[];
  similarIncidents: Array<{
    id: string;
    title: string;
    similarity: number;
    createdAt: string;
  }>;
}

interface AlertHistory {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  details?: string;
}

export default function AlertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const handleTagsUpdate = (tags: Array<{id: string; name: string; color: string}>) => {
    if (alert) {
      setAlert({
        ...alert,
        tags: tags.map(tag => tag.name)
      });
    }
  };

  useEffect(() => {
    if (params.id) {
      fetchAlertDetails();
    }
  }, [params.id, fetchAlertDetails]);

  const fetchAlertDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/api/alerts/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch alert");
      
      const data = await response.json();
      setAlert(data.alert);
      setHistory(data.history || []);
    } catch (error) {
      console.error("Error fetching alert:", error);
      toast.error("Failed to load alert details");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const handleVerify = async () => {
    try {
      setActionLoading(true);
      const response = await apiFetch(`/api/alerts/${params.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) throw new Error("Failed to verify alert");
      
      toast.success("Alert verified successfully");
      fetchAlertDetails(); // Refresh data
    } catch (error) {
      console.error("Error verifying alert:", error);
      toast.error("Failed to verify alert");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async () => {
    try {
      setActionLoading(true);
      const response = await apiFetch(`/api/alerts/${params.id}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) throw new Error("Failed to dismiss alert");
      
      toast.success("Alert dismissed successfully");
      fetchAlertDetails(); // Refresh data
    } catch (error) {
      console.error("Error dismissing alert:", error);
      toast.error("Failed to dismiss alert");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await apiFetch(`/api/alerts/${params.id}/export?format=pdf`);
      if (!response.ok) throw new Error("Failed to export PDF");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alert-${params.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export PDF");
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await apiFetch(`/api/alerts/${params.id}/export?format=csv`);
      if (!response.ok) throw new Error("Failed to export CSV");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alert-${params.id}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("CSV exported successfully");
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export CSV");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified": return "bg-green-500";
      case "dismissed": return "bg-gray-500";
      case "new": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Alert not found</h2>
          <p className="text-gray-600 mt-2">The alert you{"\'"}re looking for doesn{"\'"}t exist or has been removed.</p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Button 
          variant="outline" 
          onClick={() => router.back()}
          className="mb-4"
        >
          ← Back to Alerts
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{alert.title}</h1>
            <p className="text-gray-600 mt-2">Alert ID: {alert.id}</p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportPDF} disabled={actionLoading}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" onClick={handleExportCSV} disabled={actionLoading}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Alert Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Alert Details</CardTitle>
                <div className="flex gap-2">
                  <Badge className={`${getSeverityColor(alert.severity)} text-white`}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                  <Badge className={`${getStatusColor(alert.status)} text-white`}>
                    {alert.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{alert.description}</p>
              </div>
              
              {alert.sourceUrl && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Source</h4>
                  <a 
                    href={alert.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800"
                  >
                    {alert.source} <ExternalLink className="h-4 w-4 ml-1" />
                  </a>
                </div>
              )}
              
              <AlertTagManager
                alertId={alert.id}
                currentTags={alert.tags.map((tag, index) => ({
                  id: `tag_${index}`,
                  name: tag,
                  color: "#6b7280"
                }))}
                onTagsUpdate={handleTagsUpdate}
              />
            </CardContent>
          </Card>

          {/* Risk Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Analysis</CardTitle>
              <CardDescription>AI-generated risk assessment and factors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Confidence Score</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${alert.confidence * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">
                    {Math.round(alert.confidence * 100)}%
                  </span>
                </div>
              </div>
              
              {alert.riskFactors.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Risk Factors</h4>
                  <ul className="space-y-1">
                    {alert.riskFactors.map((factor, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Similar Incidents */}
          {alert.similarIncidents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Similar Incidents</CardTitle>
                <CardDescription>Previously reported incidents with similar content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alert.similarIncidents.map((incident) => (
                    <div key={incident.id} className="border rounded-lg p-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium text-gray-900">{incident.title}</h5>
                        <Badge variant="outline">
                          {Math.round(incident.similarity * 100)}% similar
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {format(new Date(incident.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alert.status === "new" && (
                <>
                  <Button 
                    onClick={handleVerify} 
                    disabled={actionLoading}
                    className="w-full"
                  >
                    Verify Alert
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleDismiss} 
                    disabled={actionLoading}
                    className="w-full"
                  >
                    Dismiss Alert
                  </Button>
                </>
              )}
              
              {alert.status === "verified" && (
                <div className="text-center py-4">
                  <Badge className="bg-green-500 text-white mb-2">Verified</Badge>
                  <p className="text-sm text-gray-600">
                    Verified by {alert.verifiedBy}
                  </p>
                </div>
              )}
              
              {alert.status === "dismissed" && (
                <div className="text-center py-4">
                  <Badge className="bg-gray-500 text-white mb-2">Dismissed</Badge>
                  <p className="text-sm text-gray-600">
                    Dismissed by {alert.dismissedBy}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-sm text-gray-600">
                    {format(new Date(alert.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>
              
              {alert.verifiedAt && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">Verified</p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(alert.verifiedAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              )}
              
              {alert.dismissedAt && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">Dismissed</p>
                    <p className="text-sm text-gray-600">
                      {format(new Date(alert.dismissedAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Activity History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {history.length > 0 ? (
                  history.map((entry) => (
                    <div key={entry.id} className="border-l-2 border-gray-200 pl-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{entry.action}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(entry.timestamp), "MMM d, h:mm a")}
                        </p>
                      </div>
                      <p className="text-xs text-gray-600">by {entry.user}</p>
                      {entry.details && (
                        <p className="text-xs text-gray-500 mt-1">{entry.details}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No activity history available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
