/**
 * Shared TypeScript types
 */

export enum UserRole {
  VIEWER = 'viewer',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
}

export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface UserCreate {
  email: string;
  username: string;
  password: string;
  full_name?: string | null;
}

export interface UserLogin {
  username: string;
  password: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  user: User;
  access_token: string;
  token_type: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

export interface ApiError {
  detail: string;
}

// Incident types
export enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum IncidentStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export interface Incident {
  id: number;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  location: string | null;
  source: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  expires_at: string | null;
}

export interface IncidentCreate {
  title: string;
  description: string;
  severity?: string;
  status?: string;
  location?: string | null;
  source?: string | null;
  expires_at?: string | null;
}

export interface IncidentUpdate {
  title?: string;
  description?: string;
  severity?: string;
  status?: string;
  location?: string | null;
  source?: string | null;
  expires_at?: string | null;
}

export interface IncidentList {
  incidents: Incident[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface IncidentFilters {
  page?: number;
  page_size?: number;
  severity?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  keyword?: string;
}

// Tip types
export interface Tip {
  id: number;
  content: string;
  image_url: string | null;
  submitter_email: string | null;
  submitter_phone: string | null;
  location: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface TipCreate {
  content: string;
  submitter_email?: string | null;
  submitter_phone?: string | null;
  location?: string | null;
  expires_at?: string | null;
}

// Alert types
export enum AlertType {
  SMS = 'sms',
  EMAIL = 'email',
  BOTH = 'both',
}

export enum AlertStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

export interface Alert {
  id: number;
  title: string;
  message: string;
  alert_type: AlertType;
  status: AlertStatus;
  created_by: number;
  created_at: string;
  sent_at: string | null;
  recipients_count: number;
  error_message: string | null;
}

export interface AlertCreate {
  title: string;
  message: string;
  alert_type?: string;
}

// Event types
export interface Event {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  event_time: string | null;
  risk_score: number | null;
  recommendations: string[] | null;
  created_at: string;
  updated_at: string | null;
}

export interface EventCreate {
  title: string;
  description?: string | null;
  location?: string | null;
  time?: string | null;
}

export interface EventScore {
  score: number;
  recommendations: string[];
}

// Subscriber types
export interface Subscriber {
  id: number;
  email: string | null;
  phone: string | null;
  name: string | null;
  is_active: boolean;
  subscribed_at: string;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

