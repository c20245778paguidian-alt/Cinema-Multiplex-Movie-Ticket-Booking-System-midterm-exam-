<?php

namespace App\Services;

use App\Models\CinemaHall;
use App\Models\Movie;
use App\Models\MovieBooking;
use App\Models\Seat;
use App\Models\Showtime;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CinemaBookingService
{
    public function createCinemaHall(array $data): CinemaHall
    {
        return DB::transaction(function () use ($data) {
            $hallNumber = trim(strip_tags($data['hall_number']));
            $seatCodes = collect($data['seat_codes'] ?? [])
                ->map(fn (string $seatCode) => strtoupper(trim(strip_tags($seatCode))))
                ->values();

            if ($hallNumber === '') {
                throw ValidationException::withMessages([
                    'hall_number' => 'Enter a valid hall number.',
                ]);
            }

            if ($seatCodes->contains('')) {
                throw ValidationException::withMessages([
                    'seat_codes' => 'Seat codes cannot be blank.',
                ]);
            }

            if ($seatCodes->unique()->count() !== $seatCodes->count()) {
                throw ValidationException::withMessages([
                    'seat_codes' => 'Seat codes must be unique after trimming and formatting.',
                ]);
            }

            $hall = CinemaHall::create([
                'hall_number' => $hallNumber,
            ]);

            $hall->seats()->createMany($seatCodes
                ->map(fn (string $seatCode) => ['seat_code' => $seatCode])
                ->all());

            return $hall->load('seats');
        });
    }

    public function createMovie(array $data): Movie
    {
        $attributes = $this->sanitizeMovie($data);

        return DB::transaction(fn () => Movie::create($attributes));
    }

    public function updateMovie(Movie $movie, array $data): Movie
    {
        return DB::transaction(function () use ($movie, $data) {
            $movie->update($this->sanitizeMovie($data));

            return $movie->refresh();
        });
    }

    public function updateCinemaHall(CinemaHall $cinemaHall, array $data): CinemaHall
    {
        return DB::transaction(function () use ($cinemaHall, $data) {
            $cinemaHall = CinemaHall::query()->lockForUpdate()->findOrFail($cinemaHall->id);

            if (isset($data['hall_number'])) {
                $hallNumber = trim(strip_tags($data['hall_number']));

                if ($hallNumber === '') {
                    throw ValidationException::withMessages([
                        'hall_number' => 'Enter a valid hall number.',
                    ]);
                }

                $cinemaHall->update([
                    'hall_number' => $hallNumber,
                ]);
            }

            if (isset($data['seat_codes'])) {
                $seatCodes = collect($data['seat_codes'])
                    ->map(fn (string $seatCode) => strtoupper(trim(strip_tags($seatCode))))
                    ->values();

                if ($seatCodes->contains('') || $seatCodes->unique()->count() !== $seatCodes->count()) {
                    throw ValidationException::withMessages([
                        'seat_codes' => 'Seat codes must be non-empty and unique after trimming and formatting.',
                    ]);
                }

                $existingSeats = $cinemaHall->seats()->lockForUpdate()->get();
                $removedSeats = $existingSeats->reject(fn (Seat $seat) => $seatCodes->contains($seat->seat_code));
                $reservedSeat = $removedSeats->first(fn (Seat $seat) => $seat->bookings()->exists());

                if ($reservedSeat) {
                    throw ValidationException::withMessages([
                        'seat_codes' => "Seat {$reservedSeat->seat_code} has a booking and cannot be removed.",
                    ]);
                }

                $removedSeats->each->delete();

                foreach ($seatCodes as $seatCode) {
                    $existingSeat = $existingSeats->firstWhere('seat_code', $seatCode);

                    if ($existingSeat) {
                        continue;
                    }

                    $cinemaHall->seats()->create(['seat_code' => $seatCode]);
                }
            }

            return $cinemaHall->refresh()->load('seats');
        });
    }

    public function createShowtime(array $data): Showtime
    {
        return DB::transaction(fn () => Showtime::create($this->sanitizeShowtime($data)));
    }

    public function updateShowtime(Showtime $showtime, array $data): Showtime
    {
        return DB::transaction(function () use ($showtime, $data) {
            $showtime = Showtime::query()->lockForUpdate()->findOrFail($showtime->id);
            $updates = $this->sanitizeShowtime($data);

            if (
                isset($updates['cinema_hall_id'])
                && (int) $updates['cinema_hall_id'] !== $showtime->cinema_hall_id
                && $showtime->bookings()->exists()
            ) {
                throw ValidationException::withMessages([
                    'cinema_hall_id' => 'A showtime with reservations cannot be moved to another hall.',
                ]);
            }

            $showtime->update($updates);

            return $showtime->refresh();
        });
    }

    public function createMovieBooking(array $data): MovieBooking
    {
        return DB::transaction(function () use ($data) {
            [$showtime, $seat] = $this->lockAndValidateSeat(
                (int) $data['showtime_id'],
                (int) $data['seat_id'],
            );
            $ticketType = $data['ticket_type'];

            return MovieBooking::create([
                'customer_email' => strtolower(trim(strip_tags($data['customer_email']))),
                'showtime_id' => $showtime->id,
                'seat_id' => $seat->id,
                'ticket_type' => $ticketType,
                'total_amount' => $this->ticketPrice($ticketType),
                'payment_status' => $data['payment_status'] ?? 'pending',
            ]);
        });
    }

    public function updateMovieBooking(MovieBooking $booking, array $data): MovieBooking
    {
        return DB::transaction(function () use ($booking, $data) {
            $showtimeId = (int) ($data['showtime_id'] ?? $booking->showtime_id);
            $seatId = (int) ($data['seat_id'] ?? $booking->seat_id);
            [$showtime, $seat] = $this->lockAndValidateSeat($showtimeId, $seatId, $booking->booking_id);
            $ticketType = $data['ticket_type'] ?? $booking->ticket_type;

            $booking->update([
                'customer_email' => strtolower(trim(strip_tags($data['customer_email'] ?? $booking->customer_email))),
                'showtime_id' => $showtime->id,
                'seat_id' => $seat->id,
                'ticket_type' => $ticketType,
                'total_amount' => $this->ticketPrice($ticketType),
                'payment_status' => $data['payment_status'] ?? $booking->payment_status,
            ]);

            return $booking->refresh();
        });
    }

    private function sanitizeShowtime(array $data): array
    {
        return array_intersect_key($data, array_flip([
            'movie_id',
            'cinema_hall_id',
            'showtime_start',
        ]));
    }

    private function sanitizeMovie(array $data): array
    {
        $attributes = [];

        foreach (['title', 'rating'] as $field) {
            if (! array_key_exists($field, $data)) {
                continue;
            }

            $value = trim(strip_tags($data[$field]));

            if ($value === '') {
                throw ValidationException::withMessages([
                    $field => "Enter a valid movie {$field}.",
                ]);
            }

            $attributes[$field] = $value;
        }

        return $attributes;
    }

    /**
     * @return array{Showtime, Seat}
     */
    private function lockAndValidateSeat(int $showtimeId, int $seatId, ?int $exceptBookingId = null): array
    {
        $showtime = Showtime::query()->lockForUpdate()->findOrFail($showtimeId);
        $seat = Seat::query()->lockForUpdate()->findOrFail($seatId);

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
