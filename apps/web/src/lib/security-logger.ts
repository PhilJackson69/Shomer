/**
 * Security logging utility with key redaction
 */

/**
 * Redact sensitive information from logs
 */
export function redactKey(key: string): string {
  if (!key || key.length < 8) return '[REDACTED]';
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

/**
 * Redact API key from headers object
 */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted = { ...headers };
  
  // Redact API key headers
  if (redacted['x-org-api-key']) {
    redacted['x-org-api-key'] = redactKey(redacted['x-org-api-key']);
  }
  if (redacted['X-Org-Api-Key']) {
    redacted['X-Org-Api-Key'] = redactKey(redacted['X-Org-Api-Key']);
  }
  
  // Redact action secret
  if (redacted['x-action-secret']) {
    redacted['x-action-secret'] = '[REDACTED]';
  }
  if (redacted['X-Action-Secret']) {
    redacted['X-Action-Secret'] = '[REDACTED]';
  }
  
  return redacted;
}

/**
 * Security event logger
 */
export class SecurityLogger {
  private loggerName: string;

  constructor(name: string = 'security') {
    this.loggerName = name;
  }

  private log(level: 'info' | 'warn' | 'error', event: string, data: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      logger: this.loggerName,
      event,
      ...data,
    };

    // Use console for now, but could be replaced with structured logging
    console[level](`[${this.loggerName}] ${event}`, logData);
  }

  info(event: string, data: Record<string, any>) {
    this.log('info', event, data);
  }

  warn(event: string, data: Record<string, any>) {
    this.log('warn', event, data);
  }

  error(event: string, data: Record<string, any>) {
    this.log('error', event, data);
  }

  // Specific security events
  apikeyAuth(orgId: string, keyId: string, route: string, scope?: string) {
    this.info('apikey.auth', { orgId, keyId, route, scope });
  }

  apikeyScopeDenied(orgId: string, keyId: string, need: string, have: string[]) {
    this.warn('apikey.scope_denied', { orgId, keyId, need, have });
  }

  apikeyRateLimited(orgId: string, keyId: string, rpm: number) {
    this.warn('apikey.rate_limited', { orgId, keyId, rpm });
  }

  apikeyInvalid(orgId: string, keyPrefix: string, reason: string) {
    this.warn('apikey.invalid', { orgId, keyPrefix: redactKey(keyPrefix), reason });
  }

  apikeyCreated(orgId: string, keyId: string, label?: string, scopes?: string[]) {
    this.info('apikey.created', { orgId, keyId, label, scopes });
  }

  apikeyRevoked(orgId: string, keyId: string, reason?: string) {
    this.info('apikey.revoked', { orgId, keyId, reason });
  }

  apikeyDisabled(orgId: string, keyId: string, reason?: string) {
    this.info('apikey.disabled', { orgId, keyId, reason });
  }
}

// Default security logger instance
export const securityLogger = new SecurityLogger();
