import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthenticationService } from './authentication.service';

const TITLES: Record<string, string> = {
  '/':          'Dashboard',
  '/trips':     'Trip Catalog',
  '/add-trip':  'New Trip',
  '/edit-trip': 'Edit Trip',
  '/customers': 'Customers',
  '/login':     'Sign In'
};

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.css'
})
export class App {
  private currentUrl = '/';

  constructor(private authService: AuthenticationService, private router: Router) {
    this.router.events.subscribe(ev => {
      if (ev instanceof NavigationEnd) this.currentUrl = ev.urlAfterRedirects || ev.url || '/';
    });
  }

  isLoggedIn(): boolean { return this.authService.isLoggedIn(); }
  isAdmin():   boolean { return this.authService.isAdmin();   }

  userName(): string {
    return this.authService.getPayload()?.name ?? '';
  }

  userInitial(): string {
    const name = this.userName();
    if (!name) return 'A';
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'A';
  }

  currentPageTitle(): string {
    return TITLES[this.currentUrl] || 'Dashboard';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
