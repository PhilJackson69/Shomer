/**
 * API client for Shomer backend
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  User,
  UserCreate,
  UserLogin,
  Token,
  UserResponse,
  AuditLog,
  Incident,
  IncidentCreate,
  IncidentUpdate,
  IncidentList,
  IncidentFilters,
  Tip,
  TipCreate,
  Alert,
  AlertCreate,
  Event,
  EventCreate,
  EventScore,
} from './types';

export class ShomerClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor(baseURL: string = 'http://localhost:8000') {
    this.client = axios.create({
      baseURL: `${baseURL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  // Auth endpoints
  async register(userData: UserCreate): Promise<UserResponse> {
    const response = await this.client.post<UserResponse>('/auth/register', userData);
    this.setToken(response.data.access_token);
    return response.data;
  }

  async login(credentials: UserLogin): Promise<Token> {
    const response = await this.client.post<Token>('/auth/login', credentials);
    this.setToken(response.data.access_token);
    return response.data;
  }

  // User endpoints
  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>('/users/me');
    return response.data;
  }

  async listUsers(skip: number = 0, limit: number = 100): Promise<User[]> {
    const response = await this.client.get<User[]>('/users/', {
      params: { skip, limit },
    });
    return response.data;
  }

  async getUser(userId: number): Promise<User> {
    const response = await this.client.get<User>(`/users/${userId}`);
    return response.data;
  }

  // Audit endpoints
  async listAuditLogs(skip: number = 0, limit: number = 100): Promise<AuditLog[]> {
    const response = await this.client.get<AuditLog[]>('/audit/', {
      params: { skip, limit },
    });
    return response.data;
  }

  async getUserAuditLogs(
    userId: number,
    skip: number = 0,
    limit: number = 100
  ): Promise<AuditLog[]> {
    const response = await this.client.get<AuditLog[]>(`/audit/user/${userId}`, {
      params: { skip, limit },
    });
    return response.data;
  }

  // Incident endpoints
  async listIncidents(filters?: IncidentFilters): Promise<IncidentList> {
    const response = await this.client.get<IncidentList>('/incidents/', {
      params: filters,
    });
    return response.data;
  }

  async getIncident(incidentId: number): Promise<Incident> {
    const response = await this.client.get<Incident>(`/incidents/${incidentId}`);
    return response.data;
  }

  async createIncident(incident: IncidentCreate): Promise<Incident> {
    const response = await this.client.post<Incident>('/incidents/', incident);
    return response.data;
  }

  async updateIncident(incidentId: number, incident: IncidentUpdate): Promise<Incident> {
    const response = await this.client.put<Incident>(`/incidents/${incidentId}`, incident);
    return response.data;
  }

  async deleteIncident(incidentId: number): Promise<void> {
    await this.client.delete(`/incidents/${incidentId}`);
  }

  // Tip endpoints
  async submitTip(tipData: FormData): Promise<Tip> {
    const response = await this.client.post<Tip>('/tips/', tipData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getTip(tipId: number): Promise<Tip> {
    const response = await this.client.get<Tip>(`/tips/${tipId}`);
    return response.data;
  }

  async listTips(skip: number = 0, limit: number = 100): Promise<Tip[]> {
    const response = await this.client.get<Tip[]>('/tips/', {
      params: { skip, limit },
    });
    return response.data;
  }

  async deleteTip(tipId: number): Promise<void> {
    await this.client.delete(`/tips/${tipId}`);
  }

  // Alert endpoints
  async createAlert(alert: AlertCreate): Promise<Alert> {
    const response = await this.client.post<Alert>('/alerts/', alert);
    return response.data;
  }

  async getAlert(alertId: number): Promise<Alert> {
    const response = await this.client.get<Alert>(`/alerts/${alertId}`);
    return response.data;
  }

  async listAlerts(skip: number = 0, limit: number = 100): Promise<Alert[]> {
    const response = await this.client.get<Alert[]>('/alerts/', {
      params: { skip, limit },
    });
    return response.data;
  }

  // Event endpoints
  async scoreEvent(event: EventCreate): Promise<EventScore> {
    const response = await this.client.post<EventScore>('/events/score', event);
    return response.data;
  }

  async createEvent(event: EventCreate): Promise<Event> {
    const response = await this.client.post<Event>('/events/', event);
    return response.data;
  }

  async getEvent(eventId: number): Promise<Event> {
    const response = await this.client.get<Event>(`/events/${eventId}`);
    return response.data;
  }

  async listEvents(
    skip: number = 0,
    limit: number = 100,
    minRiskScore?: number
  ): Promise<Event[]> {
    const response = await this.client.get<Event[]>('/events/', {
      params: { skip, limit, min_risk_score: minRiskScore },
    });
    return response.data;
  }
}

// Export a default client instance
export const createClient = (baseURL?: string) => new ShomerClient(baseURL);

