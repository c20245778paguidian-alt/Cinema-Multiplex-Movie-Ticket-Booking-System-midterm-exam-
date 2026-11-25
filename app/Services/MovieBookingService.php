<?php

namespace App\Services;

use App\Models\MovieBooking;
use App\Models\Seat;
use App\Models\Showtime;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MovieBookingService
{
    private const BOOKING_RELATIONS = [
        'showtime:id,movie_id,cinema_hall_id,showtime_start',
        'showtime.movie:id,title,rating',
        'showtime.cinemaHall:id,hall_number',
        'seat:id,cinema_hall_id,seat_code',
    ];

    private const DEPENDENCY_RELATIONS = [
        'movie:id,title,rating',
        'cinemaHall:id,hall_number',
        'cinemaHall.seats:id,cinema_hall_id,seat_code',
        'bookings:booking_id,showtime_id,seat_id',
    ];

    public function getBookings(?string $search = null): LengthAwarePaginator
    {
        return MovieBooking::query()
            ->with(self::BOOKING_RELATIONS)
            ->when($search !== null && $search !== '', function ($query) use ($search) {
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
    }

    public function getCreateData(): array
    {
        return [
            'showtimes' => Showtime::query()
                ->select(['id', 'movie_id', 'cinema_hall_id', 'showtime_start'])
                ->with(self::DEPENDENCY_RELATIONS)
                ->orderBy('showtime_start')
                ->get(),
            'ticket_types' => config('cinema.ticket_types'),
            'payment_methods' => ['card', 'ewallet', 'cash'],
            'payment_statuses' => config('cinema.payment_statuses'),
        ];
    }

    public function getBooking(MovieBooking $booking): MovieBooking
    {
        return $booking->load(self::BOOKING_RELATIONS);
    }

    public function createMovieBooking(array $data): MovieBooking
    {
        if (array_key_exists('payment_status', $data)) {
            throw ValidationException::withMessages([
                'payment_status' => 'New bookings must remain pending until payment is confirmed.',
            ]);
        }

        $booking = DB::transaction(function () use ($data) {
            [$showtime, $seat] = $this->lockAndValidateSeat(
                (int) $data['showtime_id'],
                (int) $data['seat_id'],
                null,
                true,
            );
            $ticketType = $data['ticket_type'];

            return MovieBooking::create([
                'customer_email' => $data['customer_email'],
                'showtime_id' => $showtime->id,
                'seat_id' => $seat->id,
                'ticket_type' => $ticketType,
                'payment_method' => $data['payment_method'] ?? null,
                'total_amount' => $this->ticketPrice($ticketType),
                'payment_status' => 'pending',
            ]);
        });

        return $booking->load(self::BOOKING_RELATIONS);
    }

    public function updateMovieBooking(MovieBooking $booking, array $data): MovieBooking
    {
        $booking = DB::transaction(function () use ($booking, $data) {
            $booking = MovieBooking::query()->lockForUpdate()->findOrFail($booking->booking_id);
            $showtimeId = (int) ($data['showtime_id'] ?? $booking->showtime_id);
            $seatId = (int) ($data['seat_id'] ?? $booking->seat_id);
            [$showtime, $seat] = $this->lockAndValidateSeat($showtimeId, $seatId, $booking->booking_id);
            $ticketType = $data['ticket_type'] ?? $booking->ticket_type;

            $booking->update([
                'customer_email' => $data['customer_email'] ?? $booking->customer_email,
                'showtime_id' => $showtime->id,
                'seat_id' => $seat->id,
                'ticket_type' => $ticketType,
                'payment_method' => $data['payment_method'] ?? $booking->payment_method,
                'total_amount' => $this->ticketPrice($ticketType),
                'payment_status' => $data['payment_status'] ?? $booking->payment_status,
            ]);

            return $booking->refresh();
        });

        return $booking->load(self::BOOKING_RELATIONS);
    }

    /**
     * @return array{Showtime, Seat}
     */
    private function lockAndValidateSeat(
        int $showtimeId,
        int $seatId,
        ?int $exceptBookingId = null,
        bool $requireUpcoming = false,
    ): array {
        $showtime = Showtime::query()->lockForUpdate()->findOrFail($showtimeId);
        $seat = Seat::query()->lockForUpdate()->findOrFail($seatId);

        if ($requireUpcoming && $showtime->showtime_start->isPast()) {
            throw ValidationException::withMessages([
                'showtime_id' => 'Choose an upcoming showtime.',
            ]);
        }

        if ($seat->cinema_hall_id !== $showtime->cinema_hall_id) {
            throw ValidationException::withMessages([
                'seat_id' => 'The selected seat is not in the showtime cinema hall.',
            ]);
        }

        $reserved = MovieBooking::query()
            ->where('showtime_id', $showtime->id)
            ->where('seat_id', $seat->id)
            ->when($exceptBookingId !== null, fn ($query) => $query->where('booking_id', '!=', $exceptBookingId))
            ->exists();

        if ($reserved) {
            throw ValidationException::withMessages([
                'seat_id' => 'This seat is already reserved for the selected showtime.',
            ]);
        }

        return [$showtime, $seat];
    }

    private function ticketPrice(string $ticketType): string
    {
        $price = config("cinema.ticket_types.{$ticketType}");

        if ($price === null) {
            throw ValidationException::withMessages([
                'ticket_type' => 'Select a supported ticket type.',
            ]);
        }

        return number_format((float) $price, 2, '.', '');
    }
}
