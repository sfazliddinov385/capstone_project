import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface Customer {
  _id:   string;
  name:  string;
  email: string;
  role?: string;
}

@Component({
  selector: 'app-customer-list',
  standalone: false,
  templateUrl: './customer-list.html',
})
export class CustomerList implements OnInit {
  customers: Customer[] = [];
  filtered:  Customer[] = [];
  message:   string = '';
  search:    string = '';
  loading    = true;

  constructor(
    private http: HttpClient,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.message = '';
    this.http.get<Customer[]>(`${environment.apiUrl}/customers`).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          // Hide admin accounts so the count reflects real customers.
          const list = (data || []).filter(c => c.role !== 'admin');
          this.customers = list;
          this.filtered = list;
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          const detail = err?.status
            ? `HTTP ${err.status}` + (err?.error?.message ? ' — ' + err.error.message : '')
            : (err?.message || 'unknown');
          this.message = 'Could not load customers (' + detail + '). Check that the API is running on port 3000.';
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  applySearch(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = q
      ? this.customers.filter(c =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q))
      : this.customers;
    this.cdr.detectChanges();
  }
}
