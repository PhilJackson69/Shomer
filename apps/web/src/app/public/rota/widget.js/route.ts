import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from '@/lib/apiFetch';


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /public/rota/widget.js
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);

  const widgetScript = `
(function() {
  'use strict';
  
  // Inject CSS styles
  function injectStyles() {
    if (document.getElementById('shomer-widget-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'shomer-widget-styles';
    styles.textContent = \`
      .shomer-widget {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        color: #374151;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        max-width: 300px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      
      .shomer-widget-header {
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 8px;
        margin-bottom: 8px;
      }
      
      .shomer-widget-title {
        font-weight: 600;
        font-size: 15px;
        color: #111827;
      }
      
      .shomer-widget-content {
        font-size: 13px;
      }
      
      .shomer-widget-current {
        margin-bottom: 8px;
      }
      
      .shomer-widget-label {
        font-weight: 500;
        color: #6b7280;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 2px;
      }
      
      .shomer-widget-user {
        font-weight: 500;
        color: #111827;
        margin-bottom: 2px;
      }
      
      .shomer-widget-time {
        color: #6b7280;
        font-size: 12px;
      }
      
      .shomer-widget-upcoming {
        border-top: 1px solid #f3f4f6;
        padding-top: 8px;
      }
      
      .shomer-widget-shift {
        display: flex;
        align-items: flex-start;
        margin-bottom: 4px;
      }
      
      .shomer-widget-bullet {
        color: #9ca3af;
        margin-right: 6px;
        margin-top: 1px;
        font-size: 12px;
      }
      
      .shomer-widget-shift-details {
        flex: 1;
      }
      
      .shomer-widget-shift-user {
        font-weight: 500;
        color: #374151;
        margin-bottom: 1px;
      }
      
      .shomer-widget-shift-time {
        color: #6b7280;
        font-size: 11px;
      }
      
      .shomer-widget-unavailable {
        color: #6b7280;
        font-style: italic;
        text-align: center;
        padding: 8px;
      }
    \`;
    
    document.head.appendChild(styles);
  }
  
  // Widget configuration
  const WIDGET_CONTAINER_ID = 'shomer-rota';
  const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const API_BASE = '${origin}';
  
  // Find all widget containers on the page
  function findWidgetContainers() {
    return document.querySelectorAll('[id="' + WIDGET_CONTAINER_ID + '"][data-token]');
  }
  
  // Format time for display
  function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Format time range
  function formatTimeRange(startsAt, endsAt) {
    return formatTime(startsAt) + '–' + formatTime(endsAt);
  }
  
  // Fetch rota summary data
  async function fetchRotaData(token) {
    try {
      const response = await apiFetch(API_BASE + '/api/public/oncall/summary?token=' + encodeURIComponent(token));
      const data = await response.json();
      
      if (data.ok) {
        return data;
      } else {
        throw new Error('API returned error: ' + data.error);
      }
    } catch (error) {
      console.warn('Shomer widget: Failed to fetch data:', error.message);
      return null;
    }
  }
  
  // Render widget HTML
  function renderWidget(container, data) {
    if (!data) {
      container.innerHTML = '<div class="shomer-widget-unavailable">Shomer rota unavailable</div>';
      return;
    }
    
    const now = data.now;
    const nextShifts = data.upcoming.slice(0, 3);
    
    let html = '<div class="shomer-widget">';
    html += '<div class="shomer-widget-header">';
    html += '<div class="shomer-widget-title">' + escapeHtml(data.org.name) + ' On-Call</div>';
    html += '</div>';
    
    html += '<div class="shomer-widget-content">';
    
    // Current on-call
    if (now) {
      html += '<div class="shomer-widget-current">';
      html += '<div class="shomer-widget-label">Now:</div>';
      html += '<div class="shomer-widget-user">' + escapeHtml(now.user.name) + '</div>';
      html += '<div class="shomer-widget-time">' + formatTimeRange(now.startsAt, now.endsAt) + '</div>';
      html += '</div>';
    } else {
      html += '<div class="shomer-widget-current">';
      html += '<div class="shomer-widget-label">Now:</div>';
      html += '<div class="shomer-widget-user">No one on-call</div>';
      html += '</div>';
    }
    
    // Next shifts
    if (nextShifts.length > 0) {
      html += '<div class="shomer-widget-upcoming">';
      nextShifts.forEach(function(shift, index) {
        const startDate = new Date(shift.startsAt);
        const dateStr = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        html += '<div class="shomer-widget-shift">';
        html += '<div class="shomer-widget-bullet">•</div>';
        html += '<div class="shomer-widget-shift-details">';
        html += '<div class="shomer-widget-shift-user">' + escapeHtml(shift.user.name) + '</div>';
        html += '<div class="shomer-widget-shift-time">' + dateStr + ' ' + formatTimeRange(shift.startsAt, shift.endsAt) + '</div>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    
    html += '</div>';
    html += '</div>';
    
    container.innerHTML = html;
  }
  
  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Initialize widget for a container
  function initWidget(container) {
    // Inject styles on first widget initialization
    injectStyles();
    
    const token = container.getAttribute('data-token');
    if (!token) {
      container.innerHTML = '<div class="shomer-widget-unavailable">Invalid token</div>';
      return;
    }
    
    // Initial render
    fetchRotaData(token).then(function(data) {
      renderWidget(container, data);
    });
    
    // Set up auto-refresh
    const refreshInterval = setInterval(function() {
      fetchRotaData(token).then(function(data) {
        renderWidget(container, data);
      });
    }, REFRESH_INTERVAL);
    
    // Store interval ID for cleanup
    container._shomerRefreshInterval = refreshInterval;
  }
  
  // Initialize all widgets when DOM is ready
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    
    const containers = findWidgetContainers();
    containers.forEach(initWidget);
  }
  
  // Clean up when page unloads
  function cleanup() {
    const containers = findWidgetContainers();
    containers.forEach(function(container) {
      if (container._shomerRefreshInterval) {
        clearInterval(container._shomerRefreshInterval);
      }
    });
  }
  
  // Start initialization
  init();
  
  // Cleanup on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanup);
  }
})();
`;

  return new NextResponse(widgetScript, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
    },
  });
}
