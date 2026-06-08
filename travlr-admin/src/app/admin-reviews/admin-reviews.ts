import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface AdminReview {
  _id:               string;
  tripName:          string;
  tripCode:          string;
  userName:          string;
  rating:            number;
  comment:           string;
  createdAt?:        string;
  adminReply?:       string;
  adminReplyAt?:     string;
  adminReplyByName?: string;
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

  // Reply UI: which row is in edit mode, draft text per row, saving flags
  replyEditing: Record<string, boolean> = {};
  replyDraft:   Record<string, string>  = {};
  replySaving:  Record<string, boolean> = {};
  readonly REPLY_MAX = 1000;

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

  // ── Reply workflow ─────────────────────────────────────────
  startReply(row: AdminReview): void {
    this.replyEditing[row._id] = true;
    this.replyDraft[row._id] = row.adminReply || '';
  }

  cancelReply(row: AdminReview): void {
    this.replyEditing[row._id] = false;
    delete this.replyDraft[row._id];
  }

  saveReply(row: AdminReview): void {
    const text = (this.replyDraft[row._id] || '').trim();
    if (text.length > this.REPLY_MAX) return;
    this.replySaving[row._id] = true;
    this.http.post<AdminReview>(
      `${environment.apiUrl}/admin/reviews/${row._id}/reply`,
      { reply: text }
    ).subscribe({
      next: (updated) => {
        Object.assign(row, updated);
        this.replySaving[row._id] = false;
        this.replyEditing[row._id] = false;
        delete this.replyDraft[row._id];
        this.cdr.detectChanges();
      },
      error: () => {
        this.replySaving[row._id] = false;
        alert('Failed to save the reply.');
        this.cdr.detectChanges();
      }
    });
  }

  clearReply(row: AdminReview): void {
    if (!confirm('Remove your reply from this review?')) return;
    this.replySaving[row._id] = true;
    this.http.post<AdminReview>(
      `${environment.apiUrl}/admin/reviews/${row._id}/reply`,
      { reply: '' }
    ).subscribe({
      next: (updated) => {
        Object.assign(row, updated);
        // Mongoose $unset removes the fields; reflect that on the client.
        row.adminReply       = '';
        row.adminReplyAt     = undefined;
        row.adminReplyByName = undefined;
        this.replySaving[row._id] = false;
        this.replyEditing[row._id] = false;
        delete this.replyDraft[row._id];
        this.cdr.detectChanges();
      },
      error: () => {
        this.replySaving[row._id] = false;
        alert('Failed to clear the reply.');
        this.cdr.detectChanges();
      }
    });
  }

  replyCharsLeft(row: AdminReview): number {
    return this.REPLY_MAX - (this.replyDraft[row._id]?.length || 0);
  }

  replyCount(): number {
    return this.rows.filter(r => (r.adminReply || '').trim().length > 0).length;
  }
}
