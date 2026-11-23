<?php

namespace App\Http\Controllers;

use App\Models\Movie;
use App\Models\MovieBooking;
use App\Models\Showtime;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        $now = now();
        $seatCapacity = Showtime::query()
            ->where('showtime_start', '>=', $now)
            ->join('seats', 'seats.cinema_hall_id', '=', 'showtimes.cinema_hall_id')
            ->count('seats.id');
        $reservedSeats = MovieBooking::query()
            ->whereHas('showtime', fn ($query) => $query->where('showtime_start', '>=', $now))
            ->count();

        return response()->json([
            'total_movies' => Movie::query()->count(),
            'total_bookings' => MovieBooking::query()->count(),
            'available_seats' => max(0, $seatCapacity - $reservedSeats),
            'total_revenue' => (float) MovieBooking::query()
                ->where('payment_status', 'paid')
                ->sum('total_amount'),
        ]);
    }
}