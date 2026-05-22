import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TripDataService } from '../trip-data';
import { Trip } from '../trip';

@Component({
  selector: 'app-edit-trip',
  standalone: false,
  templateUrl: './edit-trip.html',
  styleUrl: './edit-trip.css',
})
export class EditTrip implements OnInit {
  editForm!: FormGroup;
  submitted = false;
  message: string = '';

  categories   = ['Beach', 'Diving', 'Adventure', 'Luxury', 'Cultural', 'Cruise'];
  difficulties = ['Easy', 'Moderate', 'Challenging'];

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private tripDataService: TripDataService
  ) {}

  ngOnInit(): void {
    const tripCode = localStorage.getItem('tripCode') ?? '';
    if (!tripCode) {
      this.router.navigateByUrl('/');
      return;
    }

    this.editForm = this.formBuilder.group({
      _id:           [''],
      code:          [{ value: '', disabled: true }],
      name:          ['', Validators.required],
      length:        ['', Validators.required],
      start:         ['', Validators.required],
      resort:        ['', Validators.required],
      perPerson:     ['', Validators.required],
      image:         ['', Validators.required],
      description:   ['', Validators.required],
      category:      ['Beach'],
      difficulty:    ['Easy'],
      rating:        [4.5],
      reviewCount:   [0],
      departureCity: ['New York (JFK)'],
      spotsLeft:     [20],
      includes:      ['']
    });

    this.tripDataService.getTrip(tripCode).subscribe({
      next: (trip: Trip) => {
        const startDate = new Date(trip.start).toISOString().substring(0, 10);
        // Convert includes array to comma-separated string for the input
        const includesStr = Array.isArray(trip.includes) ? trip.includes.join(', ') : '';
        this.editForm.patchValue({ ...trip, start: startDate, includes: includesStr });
      },
      error: () => {
        this.message = 'Error loading trip.';
      }
    });
  }

  get f() { return this.editForm.controls; }

  onSubmit(): void {
    this.submitted = true;
    if (this.editForm.invalid) { return; }

    const raw = { ...this.editForm.getRawValue() };
    // Convert includes from comma-separated string to array
    const includesRaw: string = raw.includes || '';
    const trip = {
      ...raw,
      includes: includesRaw.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
    } as Trip;

    this.tripDataService.updateTrip(trip).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err) => { this.message = 'Error updating trip: ' + err.message; }
    });
  }
}
