"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { SCOPES, getScopeInfo, getScopesByCategory, isPowerfulScope } from "@/lib/scopes";
import { AlertTriangle, Copy, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  label: string | null;
  prefix: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  scopes: string[] | null;
  requestsPerMinute: number | null;
}

interface ApiKeysManagerProps {
  orgId: string;
}

export function ApiKeysManager({ orgId }: ApiKeysManagerProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKey, setNewKey] = useState({
    label: "",
    scopes: [] as string[],
    requestsPerMinute: null as number | null,
    expiresAt: null as string | null,
  });
  const [showNewKey, setShowNewKey] = useState<string | null>(null);

  const scopesByCategory = getScopesByCategory();

  const loadKeys = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/orgs/${orgId}/api-keys`);
      const data = await response.json();
      if (data.ok) {
        setKeys(data.items);
      }
    } catch (error) {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const createKey = async () => {
    if (newKey.scopes.length === 0) {
      toast.error("Please select at least one scope");
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch(`/api/orgs/${orgId}/api-keys`, { method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKey),
      });

      const data = await response.json();
      if (data.ok) {
        toast.success("API key created successfully");
        setShowNewKey(data.key.value);
        setNewKey({
          label: "",
          scopes: [],
          requestsPerMinute: null,
          expiresAt: null,
        });
        setShowCreateForm(false);
        loadKeys();
      } else {
        toast.error(data.error || "Failed to create API key");
      }
    } catch (error) {
      toast.error("Failed to create API key");
    } finally {
      setLoading(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key?")) return;

    setLoading(true);
    try {
      const response = await apiFetch(`/api/orgs/${orgId}/api-keys?id=${keyId}`, { 
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.ok) {
        toast.success("API key revoked");
        loadKeys();
      } else {
        toast.error(data.error || "Failed to revoke API key");
      }
    } catch (error) {
      toast.error("Failed to revoke API key");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const formatScopes = (scopes: string[] | null) => {
    if (!scopes || scopes.length === 0) {
      return <Badge variant="secondary">Full Access</Badge>;
    }
    return scopes.map(scope => {
      const info = getScopeInfo(scope as any);
      return (
        <Badge 
          key={scope} 
          variant={isPowerfulScope(scope as any) ? "destructive" : "default"}
          className="mr-1 mb-1"
        >
          {info.label}
        </Badge>
      );
    });
  };

  const formatRpm = (rpm: number | null) => {
    if (rpm === null) return "Unlimited";
    return `${rpm}/min`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString();
  };

  // Load keys on mount
  useState(() => {
    loadKeys();
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">API Keys</h2>
          <p className="text-muted-foreground">
            Manage API keys for programmatic access to your organization
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          Create API Key
        </Button>
      </div>

      {showNewKey && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">API Key Created Successfully</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-sm">
                  {showNewKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(showNewKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                ⚠️ This key will not be shown again. Copy it now and store it securely.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New API Key</CardTitle>
            <CardDescription>
              Configure scopes and rate limits for the new API key
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                value={newKey.label}
                onChange={(e) => setNewKey({ ...newKey, label: e.target.value })}
                placeholder="e.g., Production Integration"
              />
            </div>

            <div>
              <Label>Scopes *</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Select the permissions this key should have. At least one scope is required.
              </p>
              {Object.entries(scopesByCategory).map(([category, categoryScopes]) => (
                <div key={category} className="mb-4">
                  <h4 className="font-medium mb-2">{category}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {categoryScopes.map(scope => {
                      const info = getScopeInfo(scope);
                      const isSelected = newKey.scopes.includes(scope);
                      return (
                        <div key={scope} className="flex items-start space-x-2">
                          <Checkbox
                            id={scope}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewKey({ ...newKey, scopes: [...newKey.scopes, scope] });
                              } else {
                                setNewKey({ ...newKey, scopes: newKey.scopes.filter(s => s !== scope) });
                              }
                            }}
                          />
                          <div className="grid gap-1.5 leading-none">
                            <Label
                              htmlFor={scope}
                              className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              <div className="flex items-center gap-2">
                                {info.label}
                                {info.warning && (
                                  <AlertTriangle className="h-3 w-3 text-destructive" />
                                )}
                              </div>
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              {info.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label htmlFor="rpm">Requests Per Minute (optional)</Label>
              <Input
                id="rpm"
                type="number"
                min="1"
                value={newKey.requestsPerMinute || ""}
                onChange={(e) => setNewKey({ 
                  ...newKey, 
                  requestsPerMinute: e.target.value ? parseInt(e.target.value) : null 
                })}
                placeholder="Leave empty for unlimited"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Token bucket rate limiting. Resets continuously.
              </p>
            </div>

            <div>
              <Label htmlFor="expires">Expires At (optional)</Label>
              <Input
                id="expires"
                type="datetime-local"
                value={newKey.expiresAt || ""}
                onChange={(e) => setNewKey({ ...newKey, expiresAt: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={createKey} 
                disabled={loading || newKey.scopes.length === 0}
              >
                {loading ? "Creating..." : "Create Key"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Existing API Keys</CardTitle>
          <CardDescription>
            {keys.length} API key{keys.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No API keys created yet
            </div>
          ) : (
            <div className="space-y-4">
              {keys.map((key) => (
                <div key={key.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">
                          {key.label || "Unnamed Key"}
                        </h3>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {key.prefix}...
                        </code>
                        {key.revokedAt && (
                          <Badge variant="destructive">Revoked</Badge>
                        )}
                        {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="font-medium">Scopes:</span> {formatScopes(key.scopes)}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Rate Limit:</span> {formatRpm(key.requestsPerMinute)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Created: {formatDate(key.createdAt)} | 
                          Last Used: {formatDate(key.lastUsedAt)}
                        </div>
                      </div>
                    </div>

                    {!key.revokedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeKey(key.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
