import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Trip } from './trip';
import { environment } from '../environments/environment';

const apiBaseUrl = environment.apiUrl;

@Injectable({
  providedIn: 'root',
})
export class TripDataService {
  constructor(private http: HttpClient) {}

  // GET all trips
  getTrips(): Observable<Trip[]> {
    return this.http.get<Trip[]>(`${apiBaseUrl}/trips`);
  }

  // GET one trip by code
  getTrip(tripCode: string): Observable<Trip> {
    return this.http.get<Trip>(`${apiBaseUrl}/trips/${tripCode}`);
  }

  // POST — add a new trip
  addTrip(formData: Trip): Observable<Trip> {
    return this.http.post<Trip>(`${apiBaseUrl}/trips`, formData);
  }

  // PUT — update an existing trip
  updateTrip(formData: Trip): Observable<Trip> {
    return this.http.put<Trip>(`${apiBaseUrl}/trips/${formData.code}`, formData);
  }

  // DELETE — remove a trip by code
  deleteTrip(tripCode: string): Observable<any> {
    return this.http.delete(`${apiBaseUrl}/trips/${tripCode}`);
  }
}
