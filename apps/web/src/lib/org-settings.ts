import { prisma } from "@/lib/prisma";

export interface OrganizationSettings {
  preferredTimezone: string;
  displayName: string | null;
  showRegion: boolean;
  timeFormat: "24h" | "12h";
}

// Default settings
const DEFAULT_SETTINGS: OrganizationSettings = {
  preferredTimezone: "UTC",
  displayName: null,
  showRegion: true,
  timeFormat: "24h",
};

/**
 * Get organization settings with defaults
 */
export async function getOrganizationSettings(orgId: string): Promise<OrganizationSettings> {
  try {
    const settings = await prisma.organizationSetting.findUnique({
      where: { orgId },
    });

    if (!settings) {
      return DEFAULT_SETTINGS;
    }

    return {
      preferredTimezone: settings.preferredTimezone,
      displayName: settings.displayName,
      showRegion: settings.showRegion,
      timeFormat: settings.timeFormat as "24h" | "12h",
    };
  } catch (error) {
    console.error("Failed to fetch organization settings:", error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Format a date/time using organization settings
 */
export function formatDateTime(
  date: Date,
  settings: OrganizationSettings,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: settings.preferredTimezone,
    hourCycle: settings.timeFormat === "12h" ? "h12" : "h23",
    ...options,
  };

  return new Intl.DateTimeFormat("en-US", defaultOptions).format(date);
}

/**
 * Get display name for organization (with fallback to org name)
 */
export function getDisplayName(orgName: string, settings: OrganizationSettings): string {
  return settings.displayName || orgName;
}
