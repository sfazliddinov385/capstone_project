import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../environments/environment';

const apiBaseUrl = environment.apiUrl;
const TOKEN_KEY  = 'travlr-token';

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  constructor(private http: HttpClient) {}

  register(name: string, email: string, password: string): Observable<{ token: string }> {
    return this.http
      .post<{ token: string }>(`${apiBaseUrl}/register`, { name, email, password })
      .pipe(tap(res => this.saveToken(res.token)));
  }

  login(email: string, password: string): Observable<{ token: string }> {
    return this.http
      .post<{ token: string }>(`${apiBaseUrl}/login`, { email, password })
      .pipe(tap(res => this.saveToken(res.token)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    const payload = this.getPayload();
    return !!payload && payload.exp > Date.now() / 1000;
  }

  isAdmin(): boolean {
    const payload = this.getPayload();
    return this.isLoggedIn() && payload?.role === 'admin';
  }

  getPayload(): any | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }

  private saveToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }
}
