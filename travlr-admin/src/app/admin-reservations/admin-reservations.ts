import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface AdminReservation {
  _id:           string;
  tripName:      string;
  tripCode:      string;
  resort?:       string;
  people:        number;
  totalPrice:    number;
  bookedAt:      string;
  customerName:  string;
  customerEmail: string;
}

@Component({
  selector: 'app-admin-reservations',
  standalone: false,
  templateUrl: './admin-reservations.html'
})
export class AdminReservations implements OnInit, OnDestroy {
  rows:   AdminReservation[] = [];
  loading = true;
  error   = '';
  search  = '';
  cancelling: Record<string, boolean> = {};

  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    const q = this.search.trim();
    const url = `${environment.apiUrl}/admin/reservations${q ? '?q=' + encodeURIComponent(q) : ''}`;
    this.http.get<AdminReservation[]>(url).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.rows = data || []; this.loading = false; this.cdr.detectChanges(); },
      error: () =>   { this.error = 'Could not load reservations.'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onSearchKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter') this.load();
  }

  clearSearch(): void {
    if (!this.search) return;
    this.search = '';
    this.load();
  }

  cancel(row: AdminReservation): void {
    if (!confirm(`Cancel ${row.customerName}'s booking for "${row.tripName}"?\nSeats will be returned to inventory.`)) return;
    this.cancelling[row._id] = true;
    this.http.delete(`${environment.apiUrl}/admin/reservations/${row._id}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.rows = this.rows.filter(r => r._id !== row._id);
        this.cancelling[row._id] = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cancelling[row._id] = false;
        alert('Failed to cancel that reservation.');
        this.cdr.detectChanges();
      }
    });
  }

  totalRevenue(): number {
    return this.rows.reduce((s, r) => s + (Number(r.totalPrice) || 0), 0);
  }

  totalSeats(): number {
    return this.rows.reduce((s, r) => s + (Number(r.people) || 0), 0);
  }

  formatCurrency(n: number): string {
    return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  }

  exportCsv(): void {
    const head = ['Booked', 'Customer', 'Email', 'Trip', 'Code', 'Travelers', 'Total'];
    const rows = this.rows.map(r => [
      this.formatDate(r.bookedAt),
      r.customerName, r.customerEmail,
      r.tripName, r.tripCode,
      String(r.people), String(r.totalPrice)
    ]);
    const csv = [head, ...rows].map(line =>
      line.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
