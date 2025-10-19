"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import EnableTotpModal from "@/components/mfa/EnableTotpModal";
import RecoveryCodes from "@/components/mfa/RecoveryCodes";
import { Shield, Key, Smartphone, AlertTriangle } from "lucide-react";

interface MFAStatus {
  enabled: boolean;
  totp_enabled: boolean;
  webauthn_enabled: boolean;
  has_backup_codes: boolean;
}

interface MFAConfig {
  mfa_enforce_admins: boolean;
  totp_issuer: string;
  totp_window: number;
  max_recovery_codes: number;
}

export default function SecuritySettingsPage() {
  const [mfaStatus, setMfaStatus] = useState<MFAStatus | null>(null);
  const [mfaConfig, setMfaConfig] = useState<MFAConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEnableModal, setShowEnableModal] = useState(false);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMFAStatus();
    fetchMFAConfig();
  }, []);

  const fetchMFAStatus = async () => {
    try {
      const response = await fetch("/api/v1/mfa/status", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      if (response.ok) {
        const status = await response.json();
        setMfaStatus(status);
      } else {
        setError("Failed to fetch MFA status");
      }
    } catch (err) {
      setError("Error fetching MFA status");
    } finally {
      setLoading(false);
    }
  };

  const fetchMFAConfig = async () => {
    try {
      const response = await fetch("/api/v1/mfa/config");
      
      if (response.ok) {
        const config = await response.json();
        setMfaConfig(config);
      }
    } catch (err) {
      console.error("Error fetching MFA config:", err);
    }
  };

  const handleEnableMFA = () => {
    setShowEnableModal(true);
  };

  const handleDisableMFA = async () => {
    // TODO: Implement MFA disable functionality
    alert("MFA disable functionality will be implemented");
  };

  const handleMFAEnabled = () => {
    setShowEnableModal(false);
    fetchMFAStatus();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Security Settings</h1>
        <p className="text-gray-600">
          Manage your account security settings and multi-factor authentication.
        </p>
      </div>

      {error && (
        <Alert className="mb-6" variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* MFA Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Multi-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">MFA Status:</span>
                <Badge variant={mfaStatus?.enabled ? "default" : "secondary"}>
                  {mfaStatus?.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              {mfaStatus?.enabled ? (
                <Button variant="outline" onClick={handleDisableMFA}>
                  Disable MFA
                </Button>
              ) : (
                <Button onClick={handleEnableMFA}>
                  Enable MFA
                </Button>
              )}
            </div>

            {mfaStatus?.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  <span className="text-sm">TOTP (Authenticator App):</span>
                  <Badge variant={mfaStatus.totp_enabled ? "default" : "secondary"}>
                    {mfaStatus.totp_enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  <span className="text-sm">WebAuthn (Hardware Keys):</span>
                  <Badge variant={mfaStatus.webauthn_enabled ? "default" : "secondary"}>
                    {mfaStatus.webauthn_enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>
            )}

            {mfaConfig?.mfa_enforce_admins && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Multi-factor authentication is required for admin accounts.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recovery Codes Card */}
      {mfaStatus?.enabled && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Recovery Codes</CardTitle>
            <CardDescription>
              Use these codes to access your account if you lose your authenticator device
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">Available Recovery Codes:</span>
                <Badge variant={mfaStatus.has_backup_codes ? "default" : "destructive"}>
                  {mfaStatus.has_backup_codes ? "Available" : "None"}
                </Badge>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowRecoveryCodes(true)}
                disabled={!mfaStatus.has_backup_codes}
              >
                View Recovery Codes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Security Information</CardTitle>
          <CardDescription>
            Important information about your account security
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600">
            <p className="mb-2">
              <strong>Multi-Factor Authentication (MFA)</strong> adds an extra layer of security 
              to your account by requiring a second form of verification in addition to your password.
            </p>
            <p className="mb-2">
              <strong>TOTP (Time-based One-Time Password)</strong> uses an authenticator app 
              on your smartphone to generate time-based codes.
            </p>
            <p className="mb-2">
              <strong>WebAuthn</strong> allows you to use hardware security keys or biometric 
              authentication for secure access.
            </p>
            <p>
              <strong>Recovery Codes</strong> are single-use codes that can be used to access 
              your account if you lose your authenticator device.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      {showEnableModal && (
        <EnableTotpModal
          onClose={() => setShowEnableModal(false)}
          onSuccess={handleMFAEnabled}
        />
      )}

      {showRecoveryCodes && (
        <RecoveryCodes
          onClose={() => setShowRecoveryCodes(false)}
        />
      )}
    </div>
  );
}
