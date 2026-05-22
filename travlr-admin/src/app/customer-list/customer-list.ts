import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface Customer {
  _id:   string;
  name:  string;
  email: string;
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

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<Customer[]>(`${environment.apiUrl}/customers`).subscribe({
      next: (data) => { this.customers = data; this.filtered = data; },
      error: ()     => { this.message = 'Error loading customers.'; }
    });
  }

  applySearch(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = q
      ? this.customers.filter(c =>
          c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      : this.customers;
  }
}
