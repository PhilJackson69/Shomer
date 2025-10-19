"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, Copy, Download, AlertTriangle, RefreshCw } from "lucide-react";

interface RecoveryCodesProps {
  onClose: () => void;
}

interface MFARecoveryResponse {
  success: boolean;
  new_backup_codes?: string[];
  message: string;
}

export default function RecoveryCodes({ onClose }: RecoveryCodesProps) {
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchRecoveryCodes = async () => {
    setLoading(true);
    setError(null);

    try {
      // In a real implementation, you would fetch the current recovery codes
      // For now, we'll simulate this
      const response = await fetch("/api/v1/mfa/recovery/verify", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recovery_code: "placeholder", // This would be a valid recovery code
        }),
      });

      if (response.ok) {
        const data: MFARecoveryResponse = await response.json();
        if (data.success && data.new_backup_codes) {
          setRecoveryCodes(data.new_backup_codes);
        }
      } else {
        setError("Failed to fetch recovery codes");
      }
    } catch (err) {
      setError("Error fetching recovery codes");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError("Failed to copy to clipboard");
    }
  };

  const downloadCodes = () => {
    const content = recoveryCodes.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shomer-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateNewCodes = async () => {
    setLoading(true);
    setError(null);

    try {
      // In a real implementation, this would generate new recovery codes
      // For now, we'll simulate this
      const newCodes = Array.from({ length: 10 }, () => 
        Math.random().toString(36).substring(2, 15)
      );
      setRecoveryCodes(newCodes);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError("Error generating new codes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recovery Codes</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Use these codes to access your account if you lose your authenticator device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> These recovery codes are single-use only. 
              Store them in a safe place and never share them with anyone.
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription>Action completed successfully!</AlertDescription>
            </Alert>
          )}

          {recoveryCodes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                No recovery codes available. Generate new codes to continue.
              </p>
              <Button onClick={generateNewCodes} disabled={loading}>
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Recovery Codes"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {recoveryCodes.map((code, index) => (
                  <div 
                    key={index} 
                    className="bg-gray-50 border border-gray-200 rounded-lg p-3 font-mono text-sm"
                  >
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(recoveryCodes.join("\n"))}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All Codes
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadCodes}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download as Text
                </Button>
                <Button
                  variant="outline"
                  onClick={generateNewCodes}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Generate New Codes
                    </>
                  )}
                </Button>
              </div>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Generating new recovery codes will invalidate 
                  all existing codes. Make sure to save the new codes immediately.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="pt-4 border-t">
            <h3 className="font-medium mb-2">How to Use Recovery Codes</h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                1. When prompted for a verification code during login, 
                click "Use recovery code" instead
              </p>
              <p>
                2. Enter one of the recovery codes from the list above
              </p>
              <p>
                3. The code will be used once and cannot be used again
              </p>
              <p>
                4. After using a recovery code, consider regenerating new codes 
                for security
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
