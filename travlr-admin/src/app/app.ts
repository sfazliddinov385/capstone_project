import {
  Component, HostListener, OnDestroy, OnInit, ChangeDetectorRef,
  ViewChild, ElementRef
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthenticationService } from './authentication.service';
import { environment } from '../environments/environment';

const TITLES: Record<string, string> = {
  '/':             'Dashboard',
  '/trips':        'Trip Catalog',
  '/add-trip':     'New Trip',
  '/edit-trip':    'Edit Trip',
  '/customers':    'Customers',
  '/reservations': 'Reservations',
  '/reviews':      'Reviews',
  '/login':        'Sign In'
};

interface RecentReservation {
  _id:        string;
  tripName:   string;
  tripCode:   string;
  people:     number;
  totalPrice: number;
  bookedAt:   string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  @ViewChild('topbarSearchInput') topbarSearchInput?: ElementRef<HTMLInputElement>;

  // Top bar state.
  topbarSearch = '';
  showHelp = false;
  showNotifications = false;
  notifications: RecentReservation[] = [];
  notificationsLoading = false;

  // API health indicator.
  apiConnected = true;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private currentUrl = '/';
  private destroy$ = new Subject<void>();

  // Public URL exposed to the template so external links work in production builds.
  readonly publicUrl = environment.publicUrl;

  constructor(
    private authService: AuthenticationService,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    this.router.events.pipe(takeUntil(this.destroy$)).subscribe(ev => {
      if (ev instanceof NavigationEnd) {
        this.currentUrl = ev.urlAfterRedirects || ev.url || '/';
        // Close any open overlays when the route changes.
        this.showHelp = false;
        this.showNotifications = false;
      }
    });
  }

  // Lifecycle hooks.
  ngOnInit(): void {
    this.pingHealth();
    this.healthTimer = setInterval(() => this.pingHealth(), 30000);
  }

  ngOnDestroy(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Sign in state and user display.
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
    // Drop the query string. We only need the path to find the title.
    const path = this.currentUrl.split('?')[0];
    return TITLES[path] || 'Dashboard';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // Top bar search.
  runSearch(): void {
    const q = (this.topbarSearch || '').trim();
    // Go to the trip catalog with the query in the URL. The trip catalog
    // reads it from ActivatedRoute. An empty query clears it.
    this.router.navigate(['/trips'], { queryParams: { q: q || null }, queryParamsHandling: 'merge' });
  }

  clearTopbarSearch(): void {
    this.topbarSearch = '';
    this.runSearch();
  }

  // Ctrl+K or Cmd+K focuses the top bar search.
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      this.topbarSearchInput?.nativeElement.focus();
      this.topbarSearchInput?.nativeElement.select();
    }
    // Escape closes any open overlay.
    if (ev.key === 'Escape') {
      this.showHelp = false;
      this.showNotifications = false;
    }
  }

  // Help modal.
  toggleHelp(): void {
    this.showHelp = !this.showHelp;
    this.showNotifications = false;
  }
  closeHelp(): void { this.showHelp = false; }

  // Notifications popover.
  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    this.showHelp = false;
    if (this.showNotifications && this.notifications.length === 0) {
      this.loadNotifications();
    }
  }
  closeNotifications(): void { this.showNotifications = false; }

  hasUnread(): boolean {
    // For now, "unread" just means there are recent reservations to show.
    return this.notifications.length > 0;
  }

  private loadNotifications(): void {
    this.notificationsLoading = true;
    this.http.get<any>(`${environment.apiUrl}/admin/stats`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.notifications = (data?.recentReservations || []).slice(0, 8);
          this.notificationsLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.notifications = [];
          this.notificationsLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  refreshNotifications(): void {
    this.notifications = [];
    this.loadNotifications();
  }

  notificationHref(n: RecentReservation): string {
    return `/trips?q=${encodeURIComponent(n.tripCode)}`;
  }

  formatRelative(iso: string): string {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    const now  = Date.now();
    if (!Number.isFinite(then)) return '';
    const diff = Math.max(0, now - then);
    const min  = Math.floor(diff / 60000);
    if (min < 1)   return 'just now';
    if (min < 60)  return `${min}m ago`;
    const hr  = Math.floor(min / 60);
    if (hr  < 24)  return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 30)  return `${day}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  formatCurrency(n: number): string {
    return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // API health check.
  private pingHealth(): void {
    this.http.get<{ status: string }>(`${environment.apiUrl}/health`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.apiConnected = res?.status === 'ok';
          this.cdr.detectChanges();
        },
        error: () => {
          this.apiConnected = false;
          this.cdr.detectChanges();
        }
      });
  }
}
