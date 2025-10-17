/**
 * Canonical scope definitions for API keys
 * This is the single source of truth for all scopes in the system
 */

export const SCOPES = [
  "rota.write",
  "copy.week", 
  "seed.week",
  "settings.write",
  "share.rotate",
  "webhook.manage",
  "swap.approve",
  "swap.decline",
] as const;

export type Scope = typeof SCOPES[number];

/**
 * Type guard to check if a string is a valid scope
 */
export function isScope(x: string): x is Scope {
  return (SCOPES as readonly string[]).includes(x);
}

/**
 * Validate an array of scopes, filtering out invalid ones
 */
export function validateScopes(scopes: string[]): Scope[] {
  return scopes.filter(isScope);
}

/**
 * Get scope display information
 */
export function getScopeInfo(scope: Scope) {
  const scopeInfo: Record<Scope, { label: string; description: string; category: string; warning?: boolean }> = {
    "rota.write": {
      label: "Rota Write",
      description: "Create and modify on-call schedules",
      category: "Scheduling",
    },
    "copy.week": {
      label: "Copy Week",
      description: "Copy weekly schedules from one period to another",
      category: "Scheduling",
    },
    "seed.week": {
      label: "Seed Week", 
      description: "Generate initial weekly schedules",
      category: "Scheduling",
    },
    "settings.write": {
      label: "Settings Write",
      description: "Modify organization settings and configuration",
      category: "Administration",
      warning: true, // Mark as powerful scope
    },
    "share.rotate": {
      label: "Share Rotate",
      description: "Share and rotate on-call responsibilities",
      category: "Scheduling",
    },
    "webhook.manage": {
      label: "Webhook Manage",
      description: "Create, update, and delete webhooks",
      category: "Integration",
      warning: true, // Mark as powerful scope
    },
    "swap.approve": {
      label: "Swap Approve",
      description: "Approve shift swap requests",
      category: "Scheduling",
    },
    "swap.decline": {
      label: "Swap Decline", 
      description: "Decline shift swap requests",
      category: "Scheduling",
    },
  };

  return scopeInfo[scope];
}

/**
 * Get all scopes grouped by category
 */
export function getScopesByCategory() {
  const categories: Record<string, Scope[]> = {};
  
  SCOPES.forEach(scope => {
    const info = getScopeInfo(scope);
    if (!categories[info.category]) {
      categories[info.category] = [];
    }
    categories[info.category].push(scope);
  });

  return categories;
}

/**
 * Check if a scope is considered "powerful" (requires extra caution)
 */
export function isPowerfulScope(scope: Scope): boolean {
  return getScopeInfo(scope).warning === true;
}
