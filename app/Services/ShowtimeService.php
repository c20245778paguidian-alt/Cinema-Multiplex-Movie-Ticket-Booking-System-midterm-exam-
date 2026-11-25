<?php

namespace App\Services;

use App\Models\CinemaHall;
use App\Models\Movie;
use App\Models\Showtime;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ShowtimeService
{
    public function getShowtimes(): LengthAwarePaginator
    {
        return Showtime::query()
            ->with(['movie', 'cinemaHall'])
            ->where('showtime_start', '>=', now())
            ->orderBy('showtime_start')
            ->paginate(15);
    }

    public function getCreateData(): array
    {
        return [
            'movies' => Movie::query()->orderBy('title')->get(),
            'cinema_halls' => CinemaHall::query()->with('seats')->orderBy('hall_number')->get(),
        ];
    }

    public function createShowtime(array $data): Showtime
    {
        return DB::transaction(fn () => Showtime::create($data)->load(['movie', 'cinemaHall']));
    }

    public function updateShowtime(Showtime $showtime, array $data): Showtime
    {
        return DB::transaction(function () use ($showtime, $data) {
            $showtime = Showtime::query()->lockForUpdate()->findOrFail($showtime->id);

            if (
                isset($data['cinema_hall_id'])
                && (int) $data['cinema_hall_id'] !== $showtime->cinema_hall_id
                && $showtime->bookings()->exists()
            ) {
                throw ValidationException::withMessages([
                    'cinema_hall_id' => 'A showtime with reservations cannot be moved to another hall.',
                ]);
            }

            $showtime->update($data);

            return $showtime->refresh()->load(['movie', 'cinemaHall']);
        });
    }

}
