import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Trip } from '../trip';
import { AuthenticationService } from '../authentication.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-trip-card',
  standalone: false,
  templateUrl: './trip-card.html',
  styleUrl: './trip-card.css',
})
export class TripCard {
  @Input() trip!: Trip;
  @Output() editTrip   = new EventEmitter<Trip>();
  @Output() deleteTrip = new EventEmitter<Trip>();

  constructor(private authService: AuthenticationService) {}

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  imageUrl(): string {
    const img = this.trip?.image || '';
    if (!img) return 'https://placehold.co/400x200?text=No+Image';
    return img.startsWith('http') ? img : environment.publicUrl + img;
  }

  onEdit(): void {
    this.editTrip.emit(this.trip);
  }

  onDelete(): void {
    this.deleteTrip.emit(this.trip);
  }
}
