import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TripDataService } from '../trip-data';
import { Trip } from '../trip';

@Component({
  selector: 'app-add-trip',
  standalone: false,
  templateUrl: './add-trip.html',
  styleUrl: './add-trip.css',
})
export class AddTrip implements OnInit {
  addForm!: FormGroup;
  submitted = false;
  message: string = '';

  categories  = ['Beach', 'Diving', 'Adventure', 'Luxury', 'Cultural', 'Cruise'];
  difficulties = ['Easy', 'Moderate', 'Challenging'];

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private tripDataService: TripDataService
  ) {}

  ngOnInit(): void {
    this.addForm = this.formBuilder.group({
      _id:           [''],
      code:          ['', Validators.required],
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
  }

  get f() { return this.addForm.controls; }

  onSubmit(): void {
    this.submitted = true;
    if (this.addForm.invalid) { return; }

    const raw = this.addForm.value;
    // Turn the includes string into an array. Split on commas.
    const includesRaw: string = raw.includes || '';
    const trip = {
      ...raw,
      includes: includesRaw.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
    } as Trip;

    this.tripDataService.addTrip(trip).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err) => { this.message = 'Error adding trip: ' + err.message; }
    });
  }
}
