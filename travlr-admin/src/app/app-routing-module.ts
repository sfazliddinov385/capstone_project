import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { TripListing } from './trip-listing/trip-listing';
import { AddTrip } from './add-trip/add-trip';
import { EditTrip } from './edit-trip/edit-trip';
import { Login } from './login/login';
import { CustomerList } from './customer-list/customer-list';
import { AdminReservations } from './admin-reservations/admin-reservations';
import { AdminReviews } from './admin-reviews/admin-reviews';
import { AuthGuard } from './auth.guard';

const routes: Routes = [
  { path: '',             component: Dashboard,         canActivate: [AuthGuard] },
  { path: 'trips',        component: TripListing,       canActivate: [AuthGuard] },
  { path: 'add-trip',     component: AddTrip,           canActivate: [AuthGuard] },
  { path: 'edit-trip/:code', component: EditTrip,       canActivate: [AuthGuard] },
  // Legacy path. Old code put the trip code in localStorage and navigated here.
  // The component still falls back to that, so this keeps existing links working.
  { path: 'edit-trip',    component: EditTrip,          canActivate: [AuthGuard] },
  { path: 'customers',    component: CustomerList,      canActivate: [AuthGuard] },
  { path: 'reservations', component: AdminReservations, canActivate: [AuthGuard] },
  { path: 'reviews',      component: AdminReviews,      canActivate: [AuthGuard] },
  { path: 'login',        component: Login                                       },
  { path: '**',           redirectTo: 'login'                                    }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
