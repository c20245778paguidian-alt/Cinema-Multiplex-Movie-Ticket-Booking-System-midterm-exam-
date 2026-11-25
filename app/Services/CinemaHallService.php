<?php

namespace App\Services;

use App\Models\CinemaHall;
use App\Models\MovieBooking;
use App\Models\Seat;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CinemaHallService
{
    public function create(array $data): CinemaHall
    {
        $seatCodes = collect($data['seat_codes'] ?? []);
        $this->ensureUniqueSeatCodes($seatCodes);

        return DB::transaction(function () use ($data, $seatCodes) {
            $hall = CinemaHall::create([
                'hall_number' => $data['hall_number'],
            ]);

            $hall->seats()->createMany($seatCodes
                ->map(fn (string $seatCode) => ['seat_code' => $seatCode])
                ->all());

            return $hall->load('seats');
        });
    }

    public function update(CinemaHall $cinemaHall, array $data): CinemaHall
    {
        $seatCodes = array_key_exists('seat_codes', $data)
            ? collect($data['seat_codes'])
            : null;

        if ($seatCodes !== null) {
            $this->ensureUniqueSeatCodes($seatCodes);
        }

        return DB::transaction(function () use ($cinemaHall, $data, $seatCodes) {
            $cinemaHall = CinemaHall::query()->lockForUpdate()->findOrFail($cinemaHall->id);

            if (array_key_exists('hall_number', $data)) {
                $cinemaHall->update([
                    'hall_number' => $data['hall_number'],
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

    private function ensureUniqueSeatCodes(Collection $seatCodes): void
    {
        if ($seatCodes->unique()->count() !== $seatCodes->count()) {
            throw ValidationException::withMessages([
                'seat_codes' => 'Seat codes must be unique after trimming and formatting.',
            ]);
        }
    }
}
