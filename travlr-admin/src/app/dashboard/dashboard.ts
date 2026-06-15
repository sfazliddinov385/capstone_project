import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import { environment } from '../../environments/environment';

Chart.register(...registerables);

interface DashboardStats {
  kpi: {
    totalRevenue:     number;
    totalBookings:    number;
    totalCustomers:   number;
    totalTrips:       number;
    totalReviews:     number;
    totalSeats:       number;
    avgBookingValue:  number;
  };
  bookingsByMonth: { year: number; month: number; bookings: number; revenue: number; }[];
  topTrips:         { tripCode: string; tripName: string; bookings: number; revenue: number; }[];
  revenueByCategory:{ category: string; revenue: number; bookings: number; }[];
  recentReservations: { _id: string; tripName: string; tripCode: string; people: number; totalPrice: number; bookedAt: string; }[];
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.html'
})
export class Dashboard implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('bookingsChart') bookingsChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('topTripsChart') topTripsChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChart') categoryChart!: ElementRef<HTMLCanvasElement>;

  stats: DashboardStats | null = null;
  loading = true;
  error = '';

  private charts: Chart[] = [];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.http.get<DashboardStats>(`${environment.apiUrl}/admin/stats`).subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
        this.cdr.detectChanges();
        this.renderCharts();
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load dashboard stats. Is the API running on port 3000?';
      }
    });
  }

  ngAfterViewInit(): void { /* charts render after data arrives */ }

  ngOnDestroy(): void {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
  }

  formatCurrency(n: number): string {
    return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private renderCharts(): void {
    if (!this.stats) return;

    this.charts.forEach(c => c.destroy());
    this.charts = [];

    // Bookings and revenue per month chart.
    const months = this.stats.bookingsByMonth;
    const labels = months.map(m => `${MONTH_NAMES[m.month - 1]} ${String(m.year).slice(-2)}`);

    if (this.bookingsChart?.nativeElement) {
      this.charts.push(new Chart(this.bookingsChart.nativeElement, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Bookings',
              data: months.map(m => m.bookings),
              borderColor: '#1a4a72',
              backgroundColor: 'rgba(26, 74, 114, 0.1)',
              tension: 0.35,
              fill: true,
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: '#1a4a72',
              yAxisID: 'y'
            },
            {
              label: 'Revenue ($)',
              data: months.map(m => m.revenue),
              borderColor: '#d99a2b',
              backgroundColor: 'rgba(217, 154, 43, 0.1)',
              tension: 0.35,
              fill: false,
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: '#d99a2b',
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 10, font: { size: 12 } } },
            tooltip: { mode: 'index', intersect: false }
          },
          scales: {
            x: { grid: { display: false } },
            y:  { type: 'linear', position: 'left',  beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Bookings' } },
            y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'Revenue ($)' } }
          }
        }
      }));
    }

    // Top trips by booking count chart.
    if (this.topTripsChart?.nativeElement) {
      this.charts.push(new Chart(this.topTripsChart.nativeElement, {
        type: 'bar',
        data: {
          labels: this.stats.topTrips.map(t => t.tripName),
          datasets: [{
            label: 'Bookings',
            data: this.stats.topTrips.map(t => t.bookings),
            backgroundColor: ['#1a4a72', '#2a6699', '#3a82bd', '#5aa1d9', '#7fc1f0'],
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      }));
    }

    // Revenue by category chart.
    if (this.categoryChart?.nativeElement) {
      const palette = ['#1a4a72', '#d99a2b', '#0f8a4a', '#6b3bd1', '#c0292b', '#0e6b62'];
      this.charts.push(new Chart(this.categoryChart.nativeElement, {
        type: 'doughnut',
        data: {
          labels: this.stats.revenueByCategory.map(c => c.category),
          datasets: [{
            data: this.stats.revenueByCategory.map(c => c.revenue),
            backgroundColor: palette,
            borderColor: '#ffffff',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14, font: { size: 12 } } }
          }
        }
      }));
    }
  }
}
