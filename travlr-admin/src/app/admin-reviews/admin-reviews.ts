import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface AdminReview {
  _id:        string;
  tripName:   string;
  tripCode:   string;
  userName:   string;
  rating:     number;
  comment:    string;
  createdAt?: string;
}

@Component({
  selector: 'app-admin-reviews',
  standalone: false,
  templateUrl: './admin-reviews.html'
})
export class AdminReviews implements OnInit {
  rows:    AdminReview[] = [];
  loading = true;
  error   = '';
  search  = '';
  deleting: Record<string, boolean> = {};

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = '';
    const q = this.search.trim();
    const url = `${environment.apiUrl}/admin/reviews${q ? '?q=' + encodeURIComponent(q) : ''}`;
    this.http.get<AdminReview[]>(url).subscribe({
      next: (data) => { this.rows = data || []; this.loading = false; this.cdr.detectChanges(); },
      error: () =>   { this.error = 'Could not load reviews.'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onSearchKey(ev: KeyboardEvent): void { if (ev.key === 'Enter') this.load(); }
  clearSearch(): void { if (!this.search) return; this.search = ''; this.load(); }

  remove(row: AdminReview): void {
    if (!confirm(`Delete this review by "${row.userName}" for "${row.tripName}"?\nThis cannot be undone.`)) return;
    this.deleting[row._id] = true;
    this.http.delete(`${environment.apiUrl}/admin/reviews/${row._id}`).subscribe({
      next: () => {
        this.rows = this.rows.filter(r => r._id !== row._id);
        this.deleting[row._id] = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.deleting[row._id] = false;
        alert('Failed to delete that review.');
        this.cdr.detectChanges();
      }
    });
  }

  stars(n: number): string {
    const r = Math.round(Math.max(0, Math.min(5, n || 0)));
    return '★'.repeat(r) + '☆'.repeat(5 - r);
  }

  ratingClass(n: number): string {
    if (n >= 4.5) return 'rating-excellent';
    if (n >= 3.5) return 'rating-good';
    if (n >= 2.5) return 'rating-fair';
    return 'rating-poor';
  }

  formatDate(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  averageRating(): number {
    if (!this.rows.length) return 0;
    const sum = this.rows.reduce((s, r) => s + (Number(r.rating) || 0), 0);
    return Math.round((sum / this.rows.length) * 10) / 10;
  }
}
