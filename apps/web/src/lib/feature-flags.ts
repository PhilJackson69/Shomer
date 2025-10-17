/**
 * Feature Flags
 * 
 * Centralized feature flag management for the application.
 * Feature flags can be controlled via environment variables.
 */

export const FEATURES = {
  /**
   * Evidence submission and chain-of-custody tracking
   * 
   * When enabled, users with appropriate permissions can:
   * - Upload evidence with automatic hash calculation
   * - Track chain-of-custody
   * - Verify file integrity
   * - Export chain-of-custody PDFs
   * 
   * Environment variable: NEXT_PUBLIC_FEATURE_EVIDENCE
   * Default: false (disabled)
   */
  EVIDENCE: process.env.NEXT_PUBLIC_FEATURE_EVIDENCE === 'true',
  
  // Add more feature flags here as needed
  // ADVANCED_ANALYTICS: process.env.NEXT_PUBLIC_FEATURE_ANALYTICS === 'true',
  // AI_THREAT_DETECTION: process.env.NEXT_PUBLIC_FEATURE_AI === 'true',
} as const;

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature] === true;
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(FEATURES)
    .filter(([_, enabled]) => enabled)
    .map(([feature, _]) => feature);
}

