import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { TripDataService } from '../trip-data';
import { Trip } from '../trip';
import { AuthenticationService } from '../authentication.service';
import { environment } from '../../environments/environment';

type SortKey = 'name' | 'code' | 'start' | 'perPerson' | 'spotsLeft' | 'category';

@Component({
  selector: 'app-trip-listing',
  standalone: false,
  templateUrl: './trip-listing.html',
  styleUrl: './trip-listing.css',
})
export class TripListing implements OnInit {
  trips: Trip[] = [];
  view:  Trip[] = [];
  message = '';
  loading = true;

  search = '';
  category = '';
  sortKey: SortKey = 'start';
  sortDir: 'asc' | 'desc' = 'asc';

  readonly categoryOptions = ['All', 'Beach', 'Adventure', 'Cultural', 'Luxury', 'Cruise', 'Diving'];

  constructor(
    private tripDataService: TripDataService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthenticationService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Pick up the topbar's ?q= so a search from any page lands here pre-filled.
    this.route.queryParamMap.subscribe(params => {
      const q = params.get('q') || '';
      if (q !== this.search) {
        this.search = q;
        this.applyView();
        this.cdr.detectChanges();
      }
    });
    this.getTrips();
  }

  isLoggedIn(): boolean { return this.authService.isLoggedIn(); }
  isAdmin():   boolean { return this.authService.isAdmin();   }

  imgUrl(trip: Trip): string {
    if (!trip.image) return 'https://placehold.co/56x40?text=%20';
    return trip.image.startsWith('http') ? trip.image : environment.publicUrl + trip.image;
  }

  totalSeats(): number {
    return this.trips.reduce((sum, t) => sum + (Number(t.spotsLeft) || 0), 0);
  }

  averagePrice(): number {
    if (!this.trips.length) return 0;
    const total = this.trips.reduce((sum, t) => sum + (Number(t.perPerson) || 0), 0);
    return Math.round(total / this.trips.length);
  }

  uniqueCategories(): number {
    const set = new Set(this.trips.map(t => (t.category || '').toLowerCase()).filter(Boolean));
    return set.size;
  }

  categoryClass(cat?: string): string {
    const c = (cat || '').toLowerCase();
    if (c === 'beach')     return 'cat-badge cat-beach';
    if (c === 'adventure') return 'cat-badge cat-adventure';
    if (c === 'cultural')  return 'cat-badge cat-cultural';
    if (c === 'luxury')    return 'cat-badge cat-luxury';
    if (c === 'cruise')    return 'cat-badge cat-cruise';
    if (c === 'diving')    return 'cat-badge cat-diving';
    return 'cat-badge cat-default';
  }

  difficultyClass(d?: string): string {
    const v = (d || '').toLowerCase();
    if (v === 'easy')     return 'diff-badge diff-easy';
    if (v === 'moderate') return 'diff-badge diff-moderate';
    if (v === 'hard' || v === 'challenging') return 'diff-badge diff-hard';
    return 'diff-badge diff-default';
  }

  statusFor(trip: Trip): { cls: string; label: string } {
    const left = Number(trip.spotsLeft);
    if (!Number.isFinite(left) || left <= 0) return { cls: 'status-pill status-soldout', label: 'Sold out' };
    if (left <= 5)  return { cls: 'status-pill status-limited',   label: 'Limited' };
    return            { cls: 'status-pill status-available', label: 'Available' };
  }

  setSort(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    this.applyView();
  }

  sortIcon(key: SortKey): string {
    if (this.sortKey !== key) return '↕';
    return this.sortDir === 'asc' ? '↑' : '↓';
  }

  onFilterChange(): void { this.applyView(); }

  clearFilters(): void {
    this.search = '';
    this.category = '';
    this.applyView();
  }

  clearSearch(): void {
    this.search = '';
    this.applyView();
  }

  clearCategory(): void {
    this.category = '';
    this.applyView();
  }

  exportNoop(): void {
    const rows = [['Code', 'Name', 'Resort', 'Category', 'Start', 'Price', 'Seats']];
    this.view.forEach(t => rows.push([
      t.code, t.name, t.resort, t.category || '',
      new Date(t.start).toISOString().slice(0, 10),
      String(t.perPerson), String(t.spotsLeft ?? 0)
    ]));
    const csv = rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trips-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private applyView(): void {
    const q = this.search.trim().toLowerCase();
    const cat = (this.category || '').toLowerCase();

    let rows = this.trips.filter(t => {
      const matchesSearch = !q ||
        t.name?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q) ||
        t.resort?.toLowerCase().includes(q);
      const matchesCategory = !cat || cat === 'all' || (t.category || '').toLowerCase() === cat;
      return matchesSearch && matchesCategory;
    });

    const dir = this.sortDir === 'asc' ? 1 : -1;
    rows = rows.slice().sort((a, b) => {
      const va: any = (a as any)[this.sortKey];
      const vb: any = (b as any)[this.sortKey];

      if (this.sortKey === 'start') {
        const da = new Date(va).getTime() || 0;
        const db = new Date(vb).getTime() || 0;
        return (da - db) * dir;
      }
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va ?? '').localeCompare(String(vb ?? '')) * dir;
    });

    this.view = rows;
  }

  private getTrips(): void {
    this.loading = true;
    this.tripDataService.getTrips().subscribe({
      next: (trips: Trip[]) => {
        this.ngZone.run(() => {
          this.trips = trips || [];
          this.loading = false;
          this.applyView();
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loading = false;
          this.message = 'Error retrieving trips. Is the Express server running on port 3000?';
          this.cdr.detectChanges();
        });
      }
    });
  }

  editTrip(trip: Trip): void {
    localStorage.setItem('tripCode', trip.code);
    this.router.navigateByUrl('/edit-trip');
  }

  deleteTrip(trip: Trip): void {
    if (!confirm(`Delete trip "${trip.name}" (${trip.code})? This cannot be undone.`)) return;
    this.tripDataService.deleteTrip(trip.code).subscribe({
      next: () => this.getTrips(),
      error: () => {
        this.ngZone.run(() => {
          this.message = 'Error deleting trip.';
          this.cdr.detectChanges();
        });
      }
    });
  }
}
