<?php

namespace App\Services;

use App\Models\CinemaHall;
use App\Models\Movie;
use App\Models\MovieBooking;
use App\Models\Seat;
use App\Models\Showtime;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class CinemaBookingService
{
    public function createCinemaHall(array $data): CinemaHall
    {
        $attributes = $this->sanitizeFields($data, ['hall_number']);
        if (array_key_exists('seat_codes', $data)) {
            $attributes['seat_codes'] = $this->sanitizeSeatCodes($data['seat_codes']);
        }

        $attributes = Validator::make($attributes, [
            'hall_number' => ['required', 'string', 'max:20', 'regex:/^\d+$/'],
            'seat_codes' => ['sometimes', 'array'],
            'seat_codes.*' => ['required', 'string', 'max:10'],
        ])->validate();

        $seatCodes = collect($attributes['seat_codes'] ?? []);
        $this->ensureUniqueSeatCodes($seatCodes);

        return DB::transaction(function () use ($attributes, $seatCodes) {
            $hall = CinemaHall::create([
                'hall_number' => $attributes['hall_number'],
            ]);

            $hall->seats()->createMany($seatCodes
                ->map(fn (string $seatCode) => ['seat_code' => $seatCode])
                ->all());

            return $hall->load('seats');
        });
    }

    public function createMovie(array $data): Movie
    {
        $attributes = $this->validateMovie($data);

        return DB::transaction(fn () => Movie::create($attributes));
    }

    public function updateMovie(Movie $movie, array $data): Movie
    {
        $attributes = $this->validateMovie($data, true);

        return DB::transaction(function () use ($movie, $attributes) {
            $movie->update($attributes);

            return $movie->refresh();
        });
    }

    public function updateCinemaHall(CinemaHall $cinemaHall, array $data): CinemaHall
    {
        $attributes = $this->sanitizeFields($data, ['hall_number']);
        if (array_key_exists('seat_codes', $data)) {
            $attributes['seat_codes'] = $this->sanitizeSeatCodes($data['seat_codes']);
        }

        $attributes = Validator::make($attributes, [
            'hall_number' => ['sometimes', 'required', 'string', 'max:20', 'regex:/^\d+$/'],
            'seat_codes' => ['sometimes', 'array'],
            'seat_codes.*' => ['required', 'string', 'max:10'],
        ])->validate();
        $seatCodes = array_key_exists('seat_codes', $attributes)
            ? collect($attributes['seat_codes'])
            : null;

        if ($seatCodes !== null) {
            $this->ensureUniqueSeatCodes($seatCodes);
        }

        return DB::transaction(function () use ($cinemaHall, $attributes, $seatCodes) {
            $cinemaHall = CinemaHall::query()->lockForUpdate()->findOrFail($cinemaHall->id);

            if (array_key_exists('hall_number', $attributes)) {
                $cinemaHall->update([
                    'hall_number' => $attributes['hall_number'],
                ]);
            }

            if ($seatCodes !== null) {
                $existingSeats = $cinemaHall->seats()->lockForUpdate()->get();
                $requestedSeatCodes = $seatCodes->flip();
                $existingSeatsByCode = $existingSeats->keyBy('seat_code');
                $removedSeats = $existingSeats->reject(
                    fn (Seat $seat) => $requestedSeatCodes->has($seat->seat_code),
                );
                $reservedSeatIds = $removedSeats->isEmpty()
                    ? collect()
                    : MovieBooking::query()
                        ->whereIn('seat_id', $removedSeats->modelKeys())
                        ->distinct()
                        ->pluck('seat_id')
                        ->flip();
                $reservedSeat = $removedSeats->first(
                    fn (Seat $seat) => $reservedSeatIds->has($seat->id),
                );

                if ($reservedSeat) {
                    throw ValidationException::withMessages([
                        'seat_codes' => "Seat {$reservedSeat->seat_code} has a booking and cannot be removed.",
                    ]);
                }

                $removedSeats->each->delete();

                foreach ($seatCodes as $seatCode) {
                    if ($existingSeatsByCode->has($seatCode)) {
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
        $attributes = $this->validateShowtime($data);

        return DB::transaction(fn () => Showtime::create($attributes));
    }

    public function updateShowtime(Showtime $showtime, array $data): Showtime
    {
        $updates = $this->validateShowtime($data, true);

        return DB::transaction(function () use ($showtime, $updates) {
            $showtime = Showtime::query()->lockForUpdate()->findOrFail($showtime->id);

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
        $attributes = $this->validateMovieBooking($data);

        return DB::transaction(function () use ($attributes) {
            [$showtime, $seat] = $this->lockAndValidateSeat(
                (int) $attributes['showtime_id'],
                (int) $attributes['seat_id'],
                null,
                true,
            );
            $ticketType = $attributes['ticket_type'];

            return MovieBooking::create([
                'customer_email' => $attributes['customer_email'],
                'showtime_id' => $showtime->id,
                'seat_id' => $seat->id,
                'ticket_type' => $ticketType,
                'payment_method' => $attributes['payment_method'] ?? null,
                'total_amount' => $this->ticketPrice($ticketType),
                'payment_status' => 'pending',
            ]);
        });
    }

    public function updateMovieBooking(MovieBooking $booking, array $data): MovieBooking
    {
        $attributes = $this->validateMovieBooking($data, true);

        return DB::transaction(function () use ($booking, $attributes) {
            $booking = MovieBooking::query()->lockForUpdate()->findOrFail($booking->booking_id);
            $showtimeId = (int) ($attributes['showtime_id'] ?? $booking->showtime_id);
            $seatId = (int) ($attributes['seat_id'] ?? $booking->seat_id);
            [$showtime, $seat] = $this->lockAndValidateSeat($showtimeId, $seatId, $booking->booking_id);
            $ticketType = $attributes['ticket_type'] ?? $booking->ticket_type;

            $booking->update([
                'customer_email' => $attributes['customer_email'] ?? $booking->customer_email,
                'showtime_id' => $showtime->id,
                'seat_id' => $seat->id,
                'ticket_type' => $ticketType,
                'payment_method' => $attributes['payment_method'] ?? $booking->payment_method,
                'total_amount' => $this->ticketPrice($ticketType),
                'payment_status' => $attributes['payment_status'] ?? $booking->payment_status,
            ]);

            return $booking->refresh();
        });
    }

    private function validateShowtime(array $data, bool $isUpdate = false): array
    {
        $attributes = $this->sanitizeFields($data, [
            'movie_id',
            'cinema_hall_id',
            'showtime_start',
        ]);
        $fieldRule = $isUpdate ? 'sometimes' : 'required';

        return Validator::make($attributes, [
            'movie_id' => [$fieldRule, 'integer', 'exists:movies,id'],
            'cinema_hall_id' => [$fieldRule, 'integer', 'exists:cinema_halls,id'],
            'showtime_start' => [$fieldRule, 'date', 'after:now'],
        ])->validate();
    }

    private function validateMovie(array $data, bool $isUpdate = false): array
    {
        $attributes = $this->sanitizeFields($data, ['title', 'rating']);
        $fieldRule = $isUpdate ? 'sometimes' : 'required';

        return Validator::make($attributes, [
            'title' => [$fieldRule, 'string', 'max:255'],
            'rating' => [$fieldRule, 'string', 'max:10', 'regex:/^\d+(?:\.\d+)?$/'],
        ])->validate();
    }

    private function validateMovieBooking(array $data, bool $isUpdate = false): array
    {
        $attributes = $this->sanitizeFields($data, [
            'customer_email',
            'showtime_id',
            'seat_id',
            'ticket_type',
            'payment_method',
            'payment_status',
        ]);

        if (isset($attributes['customer_email']) && is_string($attributes['customer_email'])) {
            $attributes['customer_email'] = strtolower($attributes['customer_email']);
        }

        foreach (['ticket_type', 'payment_method', 'payment_status'] as $field) {
            if (isset($attributes[$field]) && is_string($attributes[$field])) {
                $attributes[$field] = strtolower($attributes[$field]);
            }
        }

        $fieldRule = $isUpdate ? 'sometimes' : 'required';
        $rules = [
            'customer_email' => [$fieldRule, 'email', 'max:255'],
            'showtime_id' => [$fieldRule, 'integer', 'exists:showtimes,id'],
            'seat_id' => [$fieldRule, 'integer', 'exists:seats,id'],
            'ticket_type' => [$fieldRule, 'string', 'in:'.implode(',', array_keys(config('cinema.ticket_types')))],
            'payment_method' => ['sometimes', 'required', 'string', 'in:card,ewallet,cash'],
        ];

        $rules['payment_status'] = $isUpdate
            ? ['sometimes', 'required', 'string', 'in:'.implode(',', config('cinema.payment_statuses'))]
            : ['prohibited'];

        return Validator::make($attributes, $rules)->validate();
    }

    private function sanitizeFields(array $data, array $fields): array
    {
        $attributes = array_intersect_key($data, array_flip($fields));

        foreach ($attributes as $field => $value) {
            if (is_string($value)) {
                $attributes[$field] = trim(strip_tags($value));
            }
        }

        return $attributes;
    }

    private function sanitizeSeatCodes(mixed $seatCodes): mixed
    {
        if (! is_array($seatCodes)) {
            return $seatCodes;
        }

        return array_map(
            fn ($seatCode) => is_string($seatCode)
                ? strtoupper(trim(strip_tags($seatCode)))
                : $seatCode,
            $seatCodes,
        );
    }

    private function ensureUniqueSeatCodes(Collection $seatCodes): void
    {
        if ($seatCodes->unique()->count() !== $seatCodes->count()) {
            throw ValidationException::withMessages([
                'seat_codes' => 'Seat codes must be unique after trimming and formatting.',
            ]);
        }
    }

    /**
     * @return array{Showtime, Seat}
     */
    private function lockAndValidateSeat(
        int $showtimeId,
        int $seatId,
        ?int $exceptBookingId = null,
        bool $requireUpcoming = false,
    ): array
    {
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
