"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, Smartphone, Copy, CheckCircle } from "lucide-react";

interface EnableTotpModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface MFASetupResponse {
  secret: string;
  qr_code_url: string;
  backup_codes: string[];
}

export default function EnableTotpModal({ onClose, onSuccess }: EnableTotpModalProps) {
  const [step, setStep] = useState<"setup" | "verify">("setup");
  const [setupData, setSetupData] = useState<MFASetupResponse | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/mfa/totp/setup", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSetupData(data);
        setStep("verify");
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to setup TOTP");
      }
    } catch (err) {
      setError("Error setting up TOTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode.trim()) {
      setError("Please enter the verification code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/mfa/totp/enable", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: verificationCode,
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Verification failed");
      }
    } catch (err) {
      setError("Error verifying code");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const generateQRCode = (url: string) => {
    // In a real implementation, you would use a QR code library
    // For now, we'll show the URL and let users manually enter it
    return url;
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                MFA Enabled Successfully
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Multi-factor authentication has been enabled for your account. 
                Please save your recovery codes in a safe place.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Enable TOTP Authentication
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Set up two-factor authentication using an authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "setup" && (
            <>
              <div className="text-sm text-gray-600">
                <p className="mb-2">
                  TOTP (Time-based One-Time Password) adds an extra layer of security 
                  to your account by requiring a code from your authenticator app.
                </p>
                <p>
                  Click "Setup TOTP" to generate a QR code that you can scan with 
                  your authenticator app (Google Authenticator, Authy, etc.).
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleSetup} 
                disabled={loading}
                className="w-full"
              >
                {loading ? "Setting up..." : "Setup TOTP"}
              </Button>
            </>
          )}

          {step === "verify" && setupData && (
            <>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Step 1: Add to Authenticator App</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Scan this QR code with your authenticator app:
                  </p>
                  
                  {/* QR Code placeholder - in real implementation, use a QR code library */}
                  <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <p className="text-sm text-gray-500 mb-2">QR Code would appear here</p>
                    <p className="text-xs text-gray-400 break-all">
                      {setupData.qr_code_url}
                    </p>
                  </div>

                  <div className="mt-2">
                    <Label htmlFor="secret-key">Or enter this secret key manually:</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="secret-key"
                        value={setupData.secret}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(setupData.secret)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Step 2: Verify Setup</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Enter the 6-digit code from your authenticator app:
                  </p>
                  
                  <div className="space-y-2">
                    <Label htmlFor="verification-code">Verification Code</Label>
                    <Input
                      id="verification-code"
                      type="text"
                      placeholder="123456"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      maxLength={6}
                      className="text-center font-mono text-lg"
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setStep("setup")}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={handleVerify} 
                    disabled={loading || !verificationCode.trim()}
                    className="flex-1"
                  >
                    {loading ? "Verifying..." : "Enable MFA"}
                  </Button>
                </div>
              </div>

              {/* Recovery Codes */}
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">
                  Important: Save Your Recovery Codes
                </h4>
                <p className="text-sm text-yellow-700 mb-3">
                  These codes can be used to access your account if you lose your authenticator device.
                  Store them in a safe place.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {setupData.backup_codes.map((code, index) => (
                    <div key={index} className="bg-white p-2 rounded border">
                      {code}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => copyToClipboard(setupData.backup_codes.join("\n"))}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy All Codes
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
