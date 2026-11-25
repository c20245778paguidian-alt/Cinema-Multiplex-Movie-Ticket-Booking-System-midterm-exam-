<?php

namespace App\Services;

use App\Models\Movie;
use App\Models\MovieBooking;
use App\Models\Showtime;

class DashboardService
{
    public function getStats(): array
    {
        $now = now();
        $seatCapacity = Showtime::query()
            ->where('showtime_start', '>=', $now)
            ->join('seats', 'seats.cinema_hall_id', '=', 'showtimes.cinema_hall_id')
            ->count('seats.id');
        $reservedSeats = MovieBooking::query()
            ->whereHas('showtime', fn ($query) => $query->where('showtime_start', '>=', $now))
            ->count();

        return [
            'total_movies' => Movie::query()->count(),
            'total_bookings' => MovieBooking::query()->count(),
            'available_seats' => max(0, $seatCapacity - $reservedSeats),
            'total_revenue' => (float) MovieBooking::query()
                ->where('payment_status', 'paid')
                ->sum('total_amount'),
        ];
    }
}
