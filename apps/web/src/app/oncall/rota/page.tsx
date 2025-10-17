'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/apiFetch';


interface Shift {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  organizationId: string;
  organizationName: string;
  region: string | null;
  startsAt: string;
  endsAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Organization {
  id: string;
  name: string;
}

interface ShiftFormData {
  userId: string;
  startsAt: string;
  endsAt: string;
  region: string;
}

interface ShiftSwap {
  id: string;
  orgId: string;
  shiftId: string;
  requestedUserId: string;
  reason: string | null;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  shift: {
    id: string;
    startsAt: string;
    endsAt: string;
    region: string | null;
    user: {
      id: string;
      name: string;
      email: string;
    };
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface SwapRequestFormData {
  requestedUserId: string;
  reason: string;
}

export default function RotaPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showSwapRequestsPanel, setShowSwapRequestsPanel] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [swapRequestShift, setSwapRequestShift] = useState<Shift | null>(null);
  const [swapRequests, setSwapRequests] = useState<ShiftSwap[]>([]);
  const [formData, setFormData] = useState<ShiftFormData>({
    userId: '',
    startsAt: '',
    endsAt: '',
    region: '',
  });
  const [demoFormData, setDemoFormData] = useState({
    orgId: '',
    startDate: '',
  });
  const [copyFormData, setCopyFormData] = useState({
    orgId: '',
    startDate: '',
    weeks: 1,
  });
  const [swapFormData, setSwapFormData] = useState<SwapRequestFormData>({
    requestedUserId: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [copySubmitting, setCopySubmitting] = useState(false);
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [shareToken, setShareToken] = useState<string>('');
  const [rotatingToken, setRotatingToken] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [orgSettings, setOrgSettings] = useState<{
    preferredTimezone: string;
    displayName: string | null;
    showRegion: boolean;
    timeFormat: "24h" | "12h";
  } | null>(null);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    preferredTimezone: 'UTC',
    displayName: '',
    showRegion: true,
    timeFormat: '24h' as '24h' | '12h',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [webhooks, setWebhooks] = useState<Array<{ id: string; url: string; createdAt: string }>>([]);
  const [showWebhooksPanel, setShowWebhooksPanel] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ url: '', secret: '' });
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [activities, setActivities] = useState<Array<{ id: string; kind: string; summary: string; ts: string }>>([]);
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyExpiresAt, setNewKeyExpiresAt] = useState<string>(""); // ISO date (optional)
  const [newKeyPlain, setNewKeyPlain] = useState<string | null>(null);
  const [showApiKeysPanel, setShowApiKeysPanel] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [rpm, setRpm] = useState<number | undefined>(undefined);

  // Helper function to get next Monday
  const getNextMonday = (date: Date): Date => {
    const dayOfWeek = date.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(date);
    nextMonday.setDate(date.getDate() + daysUntilMonday);
    return nextMonday;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportDropdown) {
        const target = event.target as Element;
        if (!target.closest('.export-dropdown')) {
          setShowExportDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportDropdown]);

  // Fetch shifts and users
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch shifts for next 30 days
        const from = new Date().toISOString();
        const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        
        const shiftsResponse = await apiFetch(`/api/oncall/rota?from=${from}&to=${to}`);
        const shiftsData = await shiftsResponse.json();
        
        if (shiftsData.ok) {
          setShifts(shiftsData.shifts);
        } else {
          throw new Error(shiftsData.error || 'Failed to fetch shifts');
        }

        // Fetch users (mock data for now - in real app, this would be from an API)
        setUsers([
          { id: '1', name: 'John Doe', email: 'john@example.com' },
          { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
          { id: '3', name: 'Bob Johnson', email: 'bob@example.com' },
        ]);

        // Fetch organizations for demo week seeding
        const orgsResponse = await apiFetch('/api/orgs');
        const orgsData = await orgsResponse.json();
        
        if (orgsData.ok) {
          setOrganizations(orgsData.orgs);
        }

        // Set default start date to next Monday
        const nextMonday = getNextMonday(new Date());
        setDemoFormData(prev => ({
          ...prev,
          startDate: nextMonday.toISOString().split('T')[0],
        }));

        // Set default copy form data
        setCopyFormData(prev => ({
          ...prev,
          orgId: orgsData.orgs.length > 0 ? orgsData.orgs[0].id : '',
          startDate: nextMonday.toISOString().split('T')[0],
          weeks: 1,
        }));

        // Fetch share token and settings for the first organization
        if (orgsData.ok && orgsData.orgs.length > 0) {
          await fetchShareToken(orgsData.orgs[0].id);
          await fetchOrgSettings(orgsData.orgs[0].id);
          await fetchSwapRequests(orgsData.orgs[0].id);
          await fetchWebhooks(orgsData.orgs[0].id);
          await fetchActivities(orgsData.orgs[0].id);
          await loadApiKeys(orgsData.orgs[0].id);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Show toast message
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = editingShift 
        ? `/api/oncall/rota/${editingShift.id}`
        : '/api/oncall/rota';
      
      const method = editingShift ? 'PUT' : 'POST';
      
      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.ok) {
        showToast(
          editingShift ? 'Shift updated successfully' : 'Shift created successfully',
          'success'
        );
        
        // Refresh shifts
        const from = new Date().toISOString();
        const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const shiftsResponse = await apiFetch(`/api/oncall/rota?from=${from}&to=${to}`);
        const shiftsData = await shiftsResponse.json();
        
        if (shiftsData.ok) {
          setShifts(shiftsData.shifts);
        }
        
        // Reset form and close modal
        setFormData({ userId: '', startsAt: '', endsAt: '', region: '' });
        setEditingShift(null);
        setShowModal(false);
      } else {
        throw new Error(data.error || 'Failed to save shift');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to save shift',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      userId: shift.userId,
      startsAt: new Date(shift.startsAt).toISOString().slice(0, 16),
      endsAt: new Date(shift.endsAt).toISOString().slice(0, 16),
      region: shift.region || '',
    });
    setShowModal(true);
  };

  // Handle swap request
  const handleSwapRequest = (shift: Shift) => {
    setSwapRequestShift(shift);
    setSwapFormData({
      requestedUserId: '',
      reason: '',
    });
    setShowSwapModal(true);
  };

  // Handle swap submission
  const handleSwapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapRequestShift) return;

    setSwapSubmitting(true);
    try {
      const response = await apiFetch('/api/oncall/swaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId: swapRequestShift.organizationId,
          shiftId: swapRequestShift.id,
          requestedUserId: swapFormData.requestedUserId,
          reason: swapFormData.reason || null,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        showToast('Swap request created successfully', 'success');
        
        // Refresh swap requests
        await fetchSwapRequests(swapRequestShift.organizationId);
        
        // Reset form and close modal
        setSwapFormData({ requestedUserId: '', reason: '' });
        setSwapRequestShift(null);
        setShowSwapModal(false);
      } else {
        throw new Error(data.error || 'Failed to create swap request');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to create swap request',
        'error'
      );
    } finally {
      setSwapSubmitting(false);
    }
  };

  // Fetch swap requests
  const fetchSwapRequests = async (orgId: string) => {
    try {
      const response = await apiFetch(`/api/oncall/swaps?orgId=${orgId}&status=PENDING`);
      const data = await response.json();
      
      if (data.ok) {
        setSwapRequests(data.swaps);
      }
    } catch (err) {
      console.error('Failed to fetch swap requests:', err);
    }
  };

  // Handle approve swap
  const handleApproveSwap = async (swapId: string) => {
    try {
      // Get action secret from environment or prompt user
      const actionSecret = process.env.NEXT_PUBLIC_ACTION_SECRET_SEED || 
        sessionStorage.getItem('action_secret') || 
        prompt('Enter action secret:');
      
      if (!actionSecret) {
        throw new Error('Action secret is required');
      }

      // Store in sessionStorage for future use
      if (!process.env.NEXT_PUBLIC_ACTION_SECRET_SEED) {
        sessionStorage.setItem('action_secret', actionSecret);
      }

      const response = await apiFetch(`/api/oncall/swaps/${swapId}/approve`, {
        method: 'POST',
        headers: {
          'X-Action-Secret': actionSecret,
        },
      });

      const data = await response.json();

      if (data.ok) {
        showToast('Swap request approved successfully', 'success');
        
        // Refresh shifts and swap requests
        const from = new Date().toISOString();
        const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const shiftsResponse = await apiFetch(`/api/oncall/rota?from=${from}&to=${to}`);
        const shiftsData = await shiftsResponse.json();
        
        if (shiftsData.ok) {
          setShifts(shiftsData.shifts);
        }
        
        if (swapRequestShift) {
          await fetchSwapRequests(swapRequestShift.organizationId);
        }
      } else {
        if (data.code === 'TARGET_CONFLICT') {
          showToast('Cannot approve: target user has overlapping shift', 'error');
        } else {
          throw new Error(data.error || 'Failed to approve swap request');
        }
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to approve swap request',
        'error'
      );
    }
  };

  // Handle decline swap
  const handleDeclineSwap = async (swapId: string) => {
    try {
      // Get action secret from environment or prompt user
      const actionSecret = process.env.NEXT_PUBLIC_ACTION_SECRET_SEED || 
        sessionStorage.getItem('action_secret') || 
        prompt('Enter action secret:');
      
      if (!actionSecret) {
        throw new Error('Action secret is required');
      }

      // Store in sessionStorage for future use
      if (!process.env.NEXT_PUBLIC_ACTION_SECRET_SEED) {
        sessionStorage.setItem('action_secret', actionSecret);
      }

      const response = await apiFetch(`/api/oncall/swaps/${swapId}/decline`, {
        method: 'POST',
        headers: {
          'X-Action-Secret': actionSecret,
        },
      });

      const data = await response.json();

      if (data.ok) {
        showToast('Swap request declined', 'success');
        
        // Refresh swap requests
        if (swapRequestShift) {
          await fetchSwapRequests(swapRequestShift.organizationId);
        }
      } else {
        throw new Error(data.error || 'Failed to decline swap request');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to decline swap request',
        'error'
      );
    }
  };

  // Handle copy week submission
  const handleCopySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCopySubmitting(true);

    try {
      // Get action secret from environment or prompt user
      const actionSecret = process.env.NEXT_PUBLIC_ACTION_SECRET_SEED || 
        sessionStorage.getItem('action_secret') || 
        prompt('Enter action secret:');
      
      if (!actionSecret) {
        throw new Error('Action secret is required');
      }

      // Store in sessionStorage for future use
      if (!process.env.NEXT_PUBLIC_ACTION_SECRET_SEED) {
        sessionStorage.setItem('action_secret', actionSecret);
      }

      const response = await apiFetch(
        `/api/oncall/rota/copy-week?orgId=${copyFormData.orgId}&from=${copyFormData.startDate}&weeks=${copyFormData.weeks}`,
        {
          method: 'POST',
          headers: {
            'X-Action-Secret': actionSecret,
          },
        }
      );

      const data = await response.json();

      if (data.ok) {
        showToast(`Copied ${data.created} shifts (skipped ${data.skipped})`, 'success');
        
        // Refresh shifts
        const from = new Date().toISOString();
        const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const shiftsResponse = await apiFetch(`/api/oncall/rota?from=${from}&to=${to}`);
        const shiftsData = await shiftsResponse.json();
        
        if (shiftsData.ok) {
          setShifts(shiftsData.shifts);
        }
        
        // Close modal
        setShowCopyModal(false);
      } else {
        throw new Error(data.error || 'Failed to copy week');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to copy week',
        'error'
      );
    } finally {
      setCopySubmitting(false);
    }
  };

  // Handle demo week submission
  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemoSubmitting(true);

    try {
      // Get action secret from environment or prompt user
      const actionSecret = process.env.NEXT_PUBLIC_ACTION_SECRET_SEED || 
        sessionStorage.getItem('action_secret') || 
        prompt('Enter action secret:');
      
      if (!actionSecret) {
        throw new Error('Action secret is required');
      }

      // Store in sessionStorage for future use
      if (!process.env.NEXT_PUBLIC_ACTION_SECRET_SEED) {
        sessionStorage.setItem('action_secret', actionSecret);
      }

      const response = await apiFetch(
        `/api/oncall/rota/seed-week?orgId=${demoFormData.orgId}&start=${demoFormData.startDate}`,
        {
          method: 'POST',
          headers: {
            'X-Action-Secret': actionSecret,
          },
        }
      );

      const data = await response.json();

      if (data.ok) {
        showToast(`Seeded ${data.created} demo shifts`, 'success');
        
        // Refresh shifts
        const from = new Date().toISOString();
        const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const shiftsResponse = await apiFetch(`/api/oncall/rota?from=${from}&to=${to}`);
        const shiftsData = await shiftsResponse.json();
        
        if (shiftsData.ok) {
          setShifts(shiftsData.shifts);
        }
        
        // Close modal
        setShowDemoModal(false);
      } else {
        throw new Error(data.error || 'Failed to seed demo week');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to seed demo week',
        'error'
      );
    } finally {
      setDemoSubmitting(false);
    }
  };

  // Handle ICS export
  const handleExportIcs = async () => {
    try {
      // Get current org and date range from existing state
      const currentOrg = organizations[0];
      if (!currentOrg) {
        showToast('No organization selected', 'error');
        return;
      }

      // Use default 14-day window around today
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 7);
      const to = new Date(today);
      to.setDate(to.getDate() + 7);

      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];

      // Use org's preferred timezone if available, otherwise use user's timezone
      const timezone = orgSettings?.preferredTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Build ICS URL
      const icsUrl = `/api/oncall/rota.ics?orgId=${currentOrg.id}&from=${fromStr}&to=${toStr}&tz=${encodeURIComponent(timezone)}`;
      
      // Trigger download
      const link = document.createElement('a');
      link.href = icsUrl;
      link.download = `rota_${currentOrg.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${fromStr.replace(/-/g, '')}-${toStr.replace(/-/g, '')}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Calendar (.ics) exported successfully', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to export calendar',
        'error'
      );
    }
  };

  // Handle CSV export
  const handleExportCsv = async (type: 'rota' | 'audit') => {
    try {
      // Get current org and date range from existing state
      // For now, we'll use the first organization and default date range
      // In a real app, this would come from the current UI state
      const currentOrg = organizations[0];
      if (!currentOrg) {
        showToast('No organization selected', 'error');
        return;
      }

      // Use default 14-day window around today
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 7);
      const to = new Date(today);
      to.setDate(to.getDate() + 7);

      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];

      // Build CSV URL
      const csvUrl = `/api/oncall/${type}.csv?orgId=${currentOrg.id}&from=${fromStr}&to=${toStr}`;
      
      // Trigger download
      const link = document.createElement('a');
      link.href = csvUrl;
      link.download = `${type}_${currentOrg.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${fromStr.replace(/-/g, '')}-${toStr.replace(/-/g, '')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(`${type === 'rota' ? 'Rota' : 'Audit'} CSV exported successfully`, 'success');
      setShowExportDropdown(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to export CSV',
        'error'
      );
    }
  };

  // Handle share token operations
  const fetchShareToken = async (orgId: string) => {
    try {
      const response = await apiFetch(`/api/orgs/${orgId}/share-token`);
      const data = await response.json();
      
      if (data.ok) {
        setShareToken(data.shareToken);
      }
    } catch (err) {
      console.error('Failed to fetch share token:', err);
    }
  };

  // Fetch organization settings
  const fetchOrgSettings = async (orgId: string) => {
    try {
      const response = await apiFetch(`/api/orgs/${orgId}/settings`);
      const data = await response.json();
      
      if (data.ok) {
        setOrgSettings(data.settings);
        // Update form with current settings
        setSettingsForm({
          preferredTimezone: data.settings.preferredTimezone,
          displayName: data.settings.displayName || '',
          showRegion: data.settings.showRegion,
          timeFormat: data.settings.timeFormat,
        });
      }
    } catch (err) {
      console.error('Failed to fetch organization settings:', err);
    }
  };

  // Handle settings form submission
  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentOrg = organizations[0];
    if (!currentOrg) {
      showToast('No organization selected', 'error');
      return;
    }

    setSavingSettings(true);
    try {
      // Get action secret from environment or prompt user
      const actionSecret = process.env.NEXT_PUBLIC_ACTION_SECRET_SEED || 
        sessionStorage.getItem('action_secret') || 
        prompt('Enter action secret:');
      
      if (!actionSecret) {
        throw new Error('Action secret is required');
      }

      // Store in sessionStorage for future use
      if (!process.env.NEXT_PUBLIC_ACTION_SECRET_SEED) {
        sessionStorage.setItem('action_secret', actionSecret);
      }

      const response = await apiFetch(`/api/orgs/${currentOrg.id}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': actionSecret,
        },
        body: JSON.stringify({
          preferredTimezone: settingsForm.preferredTimezone,
          displayName: settingsForm.displayName || null,
          showRegion: settingsForm.showRegion,
          timeFormat: settingsForm.timeFormat,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setOrgSettings(data.settings);
        showToast('Settings saved successfully', 'success');
        setShowSettingsPanel(false);
      } else {
        throw new Error(data.error || 'Failed to save settings');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to save settings',
        'error'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRotateToken = async () => {
    const currentOrg = organizations[0];
    if (!currentOrg) {
      showToast('No organization selected', 'error');
      return;
    }

    setRotatingToken(true);
    try {
      // Get action secret from environment or prompt user
      const actionSecret = process.env.NEXT_PUBLIC_ACTION_SECRET_SEED || 
        sessionStorage.getItem('action_secret') || 
        prompt('Enter action secret:');
      
      if (!actionSecret) {
        throw new Error('Action secret is required');
      }

      // Store in sessionStorage for future use
      if (!process.env.NEXT_PUBLIC_ACTION_SECRET_SEED) {
        sessionStorage.setItem('action_secret', actionSecret);
      }

      const response = await apiFetch(`/api/orgs/${currentOrg.id}/rotate-share-token`, {
        method: 'POST',
        headers: {
          'X-Action-Secret': actionSecret,
        },
      });

      const data = await response.json();

      if (data.ok) {
        setShareToken(data.shareToken);
        showToast('Share token rotated successfully', 'success');
      } else {
        throw new Error(data.error || 'Failed to rotate token');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to rotate token',
        'error'
      );
    } finally {
      setRotatingToken(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${type} link copied to clipboard`, 'success');
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  // Fetch webhooks
  const fetchWebhooks = async (orgId: string) => {
    try {
      const response = await apiFetch(`/api/orgs/${orgId}/webhooks`);
      const data = await response.json();
      
      if (data.ok) {
        setWebhooks(data.endpoints);
      }
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
    }
  };

  // Fetch activities
  const fetchActivities = async (orgId: string) => {
    try {
      const response = await apiFetch(`/api/orgs/${orgId}/activity`);
      const data = await response.json();
      
      if (data.ok) {
        setActivities(data.items);
      }
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    }
  };

  // Handle add webhook
  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentOrg = organizations[0];
    if (!currentOrg) {
      showToast('No organization selected', 'error');
      return;
    }

    setAddingWebhook(true);
    try {
      // Get action secret from environment or prompt user
      const actionSecret = process.env.NEXT_PUBLIC_ACTION_SECRET_SEED || 
        sessionStorage.getItem('action_secret') || 
        prompt('Enter action secret:');
      
      if (!actionSecret) {
        throw new Error('Action secret is required');
      }

      // Store in sessionStorage for future use
      if (!process.env.NEXT_PUBLIC_ACTION_SECRET_SEED) {
        sessionStorage.setItem('action_secret', actionSecret);
      }

      const response = await apiFetch(`/api/orgs/${currentOrg.id}/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Action-Secret': actionSecret,
        },
        body: JSON.stringify({
          url: webhookForm.url,
          secret: webhookForm.secret,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        showToast('Webhook endpoint added successfully', 'success');
        setWebhookForm({ url: '', secret: '' });
        await fetchWebhooks(currentOrg.id);
      } else {
        throw new Error(data.error || 'Failed to add webhook endpoint');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to add webhook endpoint',
        'error'
      );
    } finally {
      setAddingWebhook(false);
    }
  };

  // Handle delete webhook
  const handleDeleteWebhook = async (webhookId: string) => {
    const currentOrg = organizations[0];
    if (!currentOrg) {
      showToast('No organization selected', 'error');
      return;
    }

    try {
      // Get action secret from environment or prompt user
      const actionSecret = process.env.NEXT_PUBLIC_ACTION_SECRET_SEED || 
        sessionStorage.getItem('action_secret') || 
        prompt('Enter action secret:');
      
      if (!actionSecret) {
        throw new Error('Action secret is required');
      }

      // Store in sessionStorage for future use
      if (!process.env.NEXT_PUBLIC_ACTION_SECRET_SEED) {
        sessionStorage.setItem('action_secret', actionSecret);
      }

      const response = await apiFetch(`/api/orgs/${currentOrg.id}/webhooks?id=${webhookId}`, {
        method: 'DELETE',
        headers: {
          'X-Action-Secret': actionSecret,
        },
      });

      const data = await response.json();

      if (data.ok) {
        showToast('Webhook endpoint deleted successfully', 'success');
        await fetchWebhooks(currentOrg.id);
      } else {
        throw new Error(data.error || 'Failed to delete webhook endpoint');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to delete webhook endpoint',
        'error'
      );
    }
  };

  // Handle delete
  const handleDelete = async (shiftId: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) {
      return;
    }

    try {
      const response = await apiFetch(`/api/oncall/rota/${shiftId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.ok) {
        showToast('Shift deleted successfully', 'success');
        
        // Refresh shifts
        const from = new Date().toISOString();
        const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const shiftsResponse = await apiFetch(`/api/oncall/rota?from=${from}&to=${to}`);
        const shiftsData = await shiftsResponse.json();
        
        if (shiftsData.ok) {
          setShifts(shiftsData.shifts);
        }
      } else {
        throw new Error(data.error || 'Failed to delete shift');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to delete shift',
        'error'
      );
    }
  };

  // API Keys functions
  async function loadApiKeys(orgId: string) {
    const res = await apiFetch(`/api/orgs/${orgId}/api-keys`, { cache: "no-store" });
    const data = await res.json();
    if (data?.ok) setApiKeys(data.items);
  }

  async function handleCreateApiKey(orgId: string) {
    try {
      setCreatingKey(true);
      const actionSecret = process.env.NEXT_PUBLIC_ACTION_SECRET_SEED || 
        sessionStorage.getItem('action_secret') || 
        prompt('Enter action secret:');
      
      if (!actionSecret) {
        throw new Error('Action secret is required');
      }

      // Store in sessionStorage for future use
      if (!process.env.NEXT_PUBLIC_ACTION_SECRET_SEED) {
        sessionStorage.setItem('action_secret', actionSecret);
      }

      const res = await apiFetch(`/api/orgs/${orgId}/api-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Action-Secret": actionSecret
        },
        body: JSON.stringify({
          label: newKeyLabel || null,
          expiresAt: newKeyExpiresAt ? new Date(newKeyExpiresAt).toISOString() : null,
          scopes: selectedScopes,
          requestsPerMinute: rpm ?? null
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to create key");
      setNewKeyPlain(data.key.value); // show once
      setNewKeyLabel("");
      setNewKeyExpiresAt("");
      setSelectedScopes([]);
      setRpm(undefined);
      await loadApiKeys(orgId);
      showToast("API key created", 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleRevokeApiKey(orgId: string, id: string) {
    try {
      const actionSecret = process.env.NEXT_PUBLIC_ACTION_SECRET_SEED || 
        sessionStorage.getItem('action_secret') || 
        prompt('Enter action secret:');
      
      if (!actionSecret) {
        throw new Error('Action secret is required');
      }

      // Store in sessionStorage for future use
      if (!process.env.NEXT_PUBLIC_ACTION_SECRET_SEED) {
        sessionStorage.setItem('action_secret', actionSecret);
      }

      const res = await apiFetch(`/api/orgs/${orgId}/api-keys?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "X-Action-Secret": actionSecret }
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to revoke key");
      await loadApiKeys(orgId);
      showToast("Key revoked", 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!orgSettings) {
      return new Date(dateString).toLocaleString();
    }

    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      timeZone: orgSettings.preferredTimezone,
      hourCycle: orgSettings.timeFormat === "12h" ? "h12" : "h23",
      dateStyle: "short",
      timeStyle: "short",
    };

    return new Intl.DateTimeFormat("en-US", options).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading rota...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error Loading Rota</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {orgSettings?.displayName ? `${orgSettings.displayName} - On-Call Rota` : 'On-Call Rota'}
            </h1>
            <p className="text-gray-600 mt-2">Manage on-call shifts and assignments</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowCopyModal(true)}
              className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm"
            >
              Copy Week → Next Week
            </button>
            <button
              onClick={() => setShowDemoModal(true)}
              className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              Add Demo Week
            </button>
            <div className="relative export-dropdown">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center"
              >
                Export CSV
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExportDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                  <div className="py-1">
                    <button
                      onClick={() => handleExportCsv('rota')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Rota CSV
                    </button>
                    <button
                      onClick={() => handleExportCsv('audit')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Audit CSV
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleExportIcs}
              className="bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm"
            >
              Add to Calendar (.ics)
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Shift
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Share Links Panel */}
        {organizations.length > 0 && shareToken && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Share links (read-only)</h3>
              <div className="flex items-center space-x-2">
                <a
                  href={`/public/rota?token=${shareToken}&from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&to=${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  View public page
                </a>
                <button
                  onClick={handleRotateToken}
                  disabled={rotatingToken}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {rotatingToken ? 'Rotating...' : 'Rotate Token'}
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              {/* ICS Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ICS Calendar Link
                </label>
                <div className="flex">
                  <input
                    type="text"
                    readOnly
                    value={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/oncall/rota.ics?token=${shareToken}&from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&to=${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`}
                    className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 bg-gray-50 text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(
                      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/oncall/rota.ics?token=${shareToken}&from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&to=${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`,
                      'ICS'
                    )}
                    className="bg-blue-600 text-white px-3 py-2 rounded-r-md hover:bg-blue-700 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* CSV Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CSV Export Link
                </label>
                <div className="flex">
                  <input
                    type="text"
                    readOnly
                    value={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/oncall/rota.csv?token=${shareToken}&from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&to=${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`}
                    className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 bg-gray-50 text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(
                      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/oncall/rota.csv?token=${shareToken}&from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&to=${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`,
                      'CSV'
                    )}
                    className="bg-blue-600 text-white px-3 py-2 rounded-r-md hover:bg-blue-700 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Anyone with these links can view exports for this org. Rotate token to revoke.
            </p>
          </div>
        )}

        {/* Organization Settings Panel */}
        {organizations.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Organization Settings</h3>
              <button
                onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700 transition-colors"
              >
                {showSettingsPanel ? 'Hide' : 'Configure'}
              </button>
            </div>
            
            {showSettingsPanel && (
              <form onSubmit={handleSettingsSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Preferred Timezone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preferred Timezone
                    </label>
                    <select
                      value={settingsForm.preferredTimezone}
                      onChange={(e) => setSettingsForm({ ...settingsForm, preferredTimezone: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    </select>
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name (optional)
                    </label>
                    <input
                      type="text"
                      value={settingsForm.displayName}
                      onChange={(e) => setSettingsForm({ ...settingsForm, displayName: e.target.value })}
                      placeholder="Optional friendly name"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Show Region */}
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settingsForm.showRegion}
                        onChange={(e) => setSettingsForm({ ...settingsForm, showRegion: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Show Region</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">Display region information in rota views</p>
                  </div>

                  {/* Time Format */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time Format
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="timeFormat"
                          value="24h"
                          checked={settingsForm.timeFormat === '24h'}
                          onChange={(e) => setSettingsForm({ ...settingsForm, timeFormat: e.target.value as '24h' | '12h' })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">24-hour</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="timeFormat"
                          value="12h"
                          checked={settingsForm.timeFormat === '12h'}
                          onChange={(e) => setSettingsForm({ ...settingsForm, timeFormat: e.target.value as '24h' | '12h' })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">12-hour</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowSettingsPanel(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Webhooks Panel */}
        {organizations.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Webhooks</h3>
              <button
                onClick={() => setShowWebhooksPanel(!showWebhooksPanel)}
                className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700 transition-colors"
              >
                {showWebhooksPanel ? 'Hide' : 'Manage'} ({webhooks.length})
              </button>
            </div>
            
            {showWebhooksPanel && (
              <div className="space-y-4">
                {/* Add Webhook Form */}
                <form onSubmit={handleAddWebhook} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Add Webhook Endpoint</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL
                      </label>
                      <input
                        type="url"
                        value={webhookForm.url}
                        onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                        placeholder="https://your-app.com/webhooks/shomer"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Secret (min 16 chars)
                      </label>
                      <input
                        type="text"
                        value={webhookForm.secret}
                        onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                        placeholder="your-webhook-secret"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        minLength={16}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button
                      type="submit"
                      disabled={addingWebhook}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {addingWebhook ? 'Adding...' : 'Add Webhook'}
                    </button>
                  </div>
                </form>

                {/* Webhook List */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Existing Endpoints</h4>
                  {webhooks.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No webhook endpoints configured</p>
                  ) : (
                    <div className="space-y-2">
                      {webhooks.map((webhook) => (
                        <div key={webhook.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{webhook.url}</div>
                            <div className="text-xs text-gray-500">
                              Added {new Date(webhook.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteWebhook(webhook.id)}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* API Keys Panel */}
        {organizations.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">API Keys (org-scoped)</h3>
              <button
                onClick={() => setShowApiKeysPanel(!showApiKeysPanel)}
                className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 transition-colors"
              >
                {showApiKeysPanel ? 'Hide' : 'Manage'} ({apiKeys.length})
              </button>
            </div>
            
            {showApiKeysPanel && (
              <div className="space-y-4">
                {/* Create */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Scopes</label>
                      <div className="flex flex-wrap gap-2">
                        {["rota.write","copy.week","seed.week","settings.write","share.rotate","webhook.manage","swap.approve","swap.decline"].map(s => (
                          <label key={s} className="inline-flex items-center gap-1 text-xs">
                            <input type="checkbox"
                              checked={selectedScopes.includes(s)}
                              onChange={e => setSelectedScopes(
                                e.target.checked ? [...selectedScopes, s] : selectedScopes.filter(x=>x!==s)
                              )}
                            />
                            <span className="px-2 py-0.5 rounded bg-gray-100">{s}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Label (optional)</label>
                      <input 
                        value={newKeyLabel} 
                        onChange={e=>setNewKeyLabel(e.target.value)} 
                        className="w-full border rounded px-3 py-2 text-sm" 
                        placeholder="CI pipeline, Zapier, etc." 
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Expires At (optional)</label>
                      <input 
                        type="date" 
                        value={newKeyExpiresAt} 
                        onChange={e=>setNewKeyExpiresAt(e.target.value)} 
                        className="border rounded px-3 py-2 text-sm" 
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Requests per minute (optional)</label>
                      <input type="number" min={1} placeholder="e.g. 60"
                        value={rpm ?? ""} onChange={e=>setRpm(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full border rounded px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={() => handleCreateApiKey(organizations[0].id)} 
                      disabled={creatingKey} 
                      className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {creatingKey ? "Creating..." : "Create API Key"}
                    </button>
                  </div>
                </div>

                {/* One-time plain key reveal */}
                {newKeyPlain && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm font-medium text-yellow-800 mb-1">Copy your key now — it won{"'"}t be shown again:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs break-all">{newKeyPlain}</code>
                      <button 
                        onClick={() => { 
                          navigator.clipboard.writeText(newKeyPlain!); 
                          showToast("Copied", 'success'); 
                        }} 
                        className="text-xs px-2 py-1 bg-yellow-600 text-white rounded"
                      >
                        Copy
                      </button>
                      <button 
                        onClick={() => setNewKeyPlain(null)} 
                        className="text-xs px-2 py-1 border rounded"
                      >
                        Hide
                      </button>
                    </div>
                  </div>
                )}

                {/* List */}
                <table className="w-full text-sm border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2 border-b">Label</th>
                      <th className="text-left p-2 border-b">Prefix</th>
                      <th className="text-left p-2 border-b">Scopes & Limits</th>
                      <th className="text-left p-2 border-b">Created</th>
                      <th className="text-left p-2 border-b">Expires</th>
                      <th className="text-left p-2 border-b">Last Used</th>
                      <th className="text-right p-2 border-b">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map(k => (
                      <tr key={k.id} className="border-t">
                        <td className="p-2">{k.label || <span className="text-gray-400">—</span>}</td>
                        <td className="p-2">
                          <code>{k.prefix}</code>
                          {k.revokedAt && <span className="ml-2 text-xs text-red-600">(revoked)</span>}
                        </td>
                        <td className="p-2">
                          {k.scopes ? k.scopes.split(",").map((s:string)=>(
                            <span key={s} className="inline-block text-xxs px-1.5 py-0.5 mr-1 rounded bg-gray-100 border">{s}</span>
                          )) : <span className="text-gray-400">—</span>}
                          {k.requestsPerMinute ? <span className="ml-2 text-xs text-gray-700">RPM: {k.requestsPerMinute}</span> : null}
                        </td>
                        <td className="p-2">{new Date(k.createdAt).toLocaleString()}</td>
                        <td className="p-2">
                          {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="p-2">
                          {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="p-2 text-right">
                          {!k.revokedAt ? (
                            <button 
                              onClick={() => handleRevokeApiKey(organizations[0].id, k.id)} 
                              className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Revoke
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500">Revoked</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Activity Panel */}
        {organizations.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Activity</h3>
              <button
                onClick={() => setShowActivityPanel(!showActivityPanel)}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
              >
                {showActivityPanel ? 'Hide' : 'Show'} Recent ({activities.length})
              </button>
            </div>
            
            {showActivityPanel && (
              <div className="space-y-3">
                {activities.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No recent activity</p>
                ) : (
                  <div className="space-y-2">
                    {activities.map((activity) => (
                      <div key={activity.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-900">{activity.summary}</div>
                          <div className="text-xs text-gray-500">
                            {formatDate(activity.ts)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Swap Requests Panel */}
        {organizations.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Swap Requests</h3>
              <button
                onClick={() => setShowSwapRequestsPanel(!showSwapRequestsPanel)}
                className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 transition-colors"
              >
                {showSwapRequestsPanel ? 'Hide' : 'Show'} Pending ({swapRequests.length})
              </button>
            </div>
            
            {showSwapRequestsPanel && (
              <div className="space-y-4">
                {swapRequests.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No pending swap requests</p>
                ) : (
                  <div className="space-y-3">
                    {swapRequests.map((swap) => (
                      <div key={swap.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4 text-sm">
                              <div>
                                <span className="font-medium">Shift:</span> {formatDate(swap.shift.startsAt)} - {formatDate(swap.shift.endsAt)}
                              </div>
                              <div>
                                <span className="font-medium">Current:</span> {swap.shift.user.name}
                              </div>
                              <div>
                                <span className="font-medium">→ Requested:</span> {swap.user.name}
                              </div>
                              {swap.reason && (
                                <div>
                                  <span className="font-medium">Reason:</span> {swap.reason}
                                </div>
                              )}
                              <div>
                                <span className="font-medium">Created:</span> {new Date(swap.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApproveSwap(swap.id)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDeclineSwap(swap.id)}
                              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Shifts Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    End Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{shift.userName}</div>
                        <div className="text-sm text-gray-500">{shift.userEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(shift.startsAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(shift.endsAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {orgSettings?.showRegion !== false ? (shift.region || '—') : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(shift)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleSwapRequest(shift)}
                        className="text-green-600 hover:text-green-900 mr-4"
                      >
                        Request swap
                      </button>
                      <button
                        onClick={() => handleDelete(shift.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {shifts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No shifts found. Click {"\"Add Shift\""} to create your first on-call assignment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">
                {editingShift ? 'Edit Shift' : 'Add Shift'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User
                  </label>
                  <select
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a user</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startsAt}
                    onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endsAt}
                    onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Region (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    placeholder="e.g., US-East, EU-West"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingShift(null);
                      setFormData({ userId: '', startsAt: '', endsAt: '', region: '' });
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : (editingShift ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Demo Week Modal */}
        {showDemoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Add Demo Week</h2>
              
              <form onSubmit={handleDemoSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization
                  </label>
                  <select
                    value={demoFormData.orgId}
                    onChange={(e) => setDemoFormData({ ...demoFormData, orgId: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select an organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={demoFormData.startDate}
                    onChange={(e) => setDemoFormData({ ...demoFormData, startDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                  <p className="font-medium mb-1">Note:</p>
                  <p>All times are stored in UTC; displayed in your local timezone.</p>
                  <p className="mt-1">Creates 7 days of 8-hour shifts (09:00-17:00 UTC) rotating between available users.</p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowDemoModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={demoSubmitting}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {demoSubmitting ? 'Seeding...' : 'Seed Demo Week'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Copy Week Modal */}
        {showCopyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Copy Week → Next Week</h2>
              
              <form onSubmit={handleCopySubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization
                  </label>
                  <select
                    value={copyFormData.orgId}
                    onChange={(e) => setCopyFormData({ ...copyFormData, orgId: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Select an organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Week
                  </label>
                  <input
                    type="date"
                    value={copyFormData.startDate}
                    onChange={(e) => setCopyFormData({ ...copyFormData, startDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weeks to Copy
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={copyFormData.weeks}
                    onChange={(e) => setCopyFormData({ ...copyFormData, weeks: parseInt(e.target.value) || 1 })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                  <p className="font-medium mb-1">Note:</p>
                  <p>Copies the 7-day window starting at the selected date.</p>
                  <p className="mt-1">Overlap-safe: skips any shifts that would conflict with existing assignments.</p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCopyModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={copySubmitting}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {copySubmitting ? 'Copying...' : 'Copy Week'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Swap Request Modal */}
        {showSwapModal && swapRequestShift && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Request Shift Swap</h2>
              
              <div className="mb-4 p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-600">
                  <strong>Current Shift:</strong><br />
                  {swapRequestShift.userName} ({swapRequestShift.userEmail})<br />
                  {formatDate(swapRequestShift.startsAt)} - {formatDate(swapRequestShift.endsAt)}
                </p>
              </div>
              
              <form onSubmit={handleSwapSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Replacement User
                  </label>
                  <select
                    value={swapFormData.requestedUserId}
                    onChange={(e) => setSwapFormData({ ...swapFormData, requestedUserId: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select a replacement user</option>
                    {users.filter(user => user.id !== swapRequestShift.userId).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason (optional)
                  </label>
                  <textarea
                    value={swapFormData.reason}
                    onChange={(e) => setSwapFormData({ ...swapFormData, reason: e.target.value })}
                    placeholder="Why do you need to swap this shift?"
                    rows={3}
                    maxLength={500}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {swapFormData.reason.length}/500 characters
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSwapModal(false);
                      setSwapRequestShift(null);
                      setSwapFormData({ requestedUserId: '', reason: '' });
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={swapSubmitting}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {swapSubmitting ? 'Creating...' : 'Request Swap'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
