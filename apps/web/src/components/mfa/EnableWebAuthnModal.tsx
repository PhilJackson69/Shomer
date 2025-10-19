"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, Key, CheckCircle } from "lucide-react";

interface EnableWebAuthnModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface WebAuthnRegisterResponse {
  challenge: string;
  rp_name: string;
  user_id: string;
  user_name: string;
  user_display_name: string;
}

export default function EnableWebAuthnModal({ onClose, onSuccess }: EnableWebAuthnModalProps) {
  const [step, setStep] = useState<"setup" | "register">("setup");
  const [credentialName, setCredentialName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSetup = async () => {
    if (!credentialName.trim()) {
      setError("Please enter a name for your security key");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/mfa/webauthn/register", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credential_name: credentialName,
        }),
      });

      if (response.ok) {
        const data: WebAuthnRegisterResponse = await response.json();
        
        // Check if WebAuthn is supported
        if (!window.navigator.credentials) {
          setError("WebAuthn is not supported in this browser");
          return;
        }

        setStep("register");
        
        // Create credential options
        const credentialOptions: CredentialCreationOptions = {
          publicKey: {
            challenge: new TextEncoder().encode(data.challenge),
            rp: {
              name: data.rp_name,
              id: window.location.hostname,
            },
            user: {
              id: new TextEncoder().encode(data.user_id),
              name: data.user_name,
              displayName: data.user_display_name,
            },
            pubKeyCredParams: [
              { type: "public-key", alg: -7 }, // ES256
              { type: "public-key", alg: -257 }, // RS256
            ],
            authenticatorSelection: {
              userVerification: "preferred",
            },
            timeout: 60000,
            attestation: "direct",
          },
        };

        // Create credential
        const credential = await navigator.credentials.create(credentialOptions);
        
        if (credential && 'response' in credential) {
          const response = credential.response as AuthenticatorAttestationResponse;
          
          // Verify credential with backend
          const verifyResponse = await fetch("/api/v1/mfa/webauthn/verify", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              credential_id: credential.id,
              client_data_json: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
              authenticator_data: btoa(String.fromCharCode(...new Uint8Array(response.authenticatorData))),
              signature: btoa(String.fromCharCode(...new Uint8Array(response.signature))),
            }),
          });

          if (verifyResponse.ok) {
            setSuccess(true);
            setTimeout(() => {
              onSuccess();
            }, 2000);
          } else {
            const errorData = await verifyResponse.json();
            setError(errorData.message || "WebAuthn verification failed");
          }
        } else {
          setError("Failed to create WebAuthn credential");
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to setup WebAuthn");
      }
    } catch (err) {
      setError("Error setting up WebAuthn");
      console.error("WebAuthn setup error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                WebAuthn Enabled Successfully
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
                WebAuthn authentication has been enabled for your account. 
                You can now use hardware security keys for authentication.
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
              <Key className="h-5 w-5" />
              Enable WebAuthn Authentication
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Set up hardware security key authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "setup" && (
            <>
              <div className="text-sm text-gray-600">
                <p className="mb-2">
                  WebAuthn allows you to use hardware security keys, biometric authentication, 
                  or platform authenticators for secure access to your account.
                </p>
                <p>
                  You'll need a compatible security key or device with biometric capabilities 
                  (like Touch ID, Face ID, or Windows Hello).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="credential-name">Security Key Name</Label>
                <Input
                  id="credential-name"
                  type="text"
                  placeholder="e.g., My YubiKey"
                  value={credentialName}
                  onChange={(e) => setCredentialName(e.target.value)}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleSetup} 
                disabled={loading || !credentialName.trim()}
                className="w-full"
              >
                {loading ? "Setting up..." : "Setup WebAuthn"}
              </Button>
            </>
          )}

          {step === "register" && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                Please interact with your security key when prompted by your browser.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                You may need to touch your security key or use biometric authentication.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
