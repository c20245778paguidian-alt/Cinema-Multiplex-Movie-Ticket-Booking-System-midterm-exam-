<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMovieBookingRequest;
use App\Http\Requests\UpdateMovieBookingRequest;
use App\Models\MovieBooking;
use App\Models\Showtime;
use App\Services\CinemaBookingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MovieBookingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = trim(strip_tags((string) $request->query('search', '')));

        $bookings = MovieBooking::query()
            ->with(['showtime.movie', 'showtime.cinemaHall', 'seat'])
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($query) use ($search) {
                    $query->where('customer_email', 'like', "%{$search}%")
                        ->orWhere('payment_status', 'like', "%{$search}%")
                        ->orWhereHas('showtime.movie', fn ($query) => $query->where('title', 'like', "%{$search}%"))
                        ->orWhereHas('showtime.cinemaHall', fn ($query) => $query->where('hall_number', 'like', "%{$search}%"))
                        ->orWhereHas('seat', fn ($query) => $query->where('seat_code', 'like', "%{$search}%"));
                });
            })
            ->latest('booking_id')
            ->paginate(15)
            ->withQueryString();

        return response()->json($bookings);
    }

    public function create(): JsonResponse
    {
        return response()->json([
            'showtimes' => Showtime::query()
                ->with(['movie', 'cinemaHall.seats', 'bookings:booking_id,showtime_id,seat_id'])
                ->orderBy('showtime_start')
                ->get(),
            'ticket_types' => config('cinema.ticket_types'),
            'payment_statuses' => config('cinema.payment_statuses'),
        ]);
    }

    public function store(StoreMovieBookingRequest $request, CinemaBookingService $service): JsonResponse
    {
        $booking = $service->createMovieBooking($request->validated());

        return response()->json(
            $booking->load(['showtime.movie', 'showtime.cinemaHall', 'seat']),
            201,
        );
    }

    public function update(
        UpdateMovieBookingRequest $request,
        string $id,
        CinemaBookingService $service,
    ): JsonResponse {
        $booking = $service->updateMovieBooking(
            MovieBooking::query()->findOrFail($id),
            $request->validated(),
        );

        return response()->json($booking->load(['showtime.movie', 'showtime.cinemaHall', 'seat']));
    }
}
