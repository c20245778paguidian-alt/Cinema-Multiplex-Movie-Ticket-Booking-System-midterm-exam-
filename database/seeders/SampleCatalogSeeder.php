<?php

namespace Database\Seeders;

use App\Models\CinemaHall;
use App\Models\Movie;
use App\Models\Showtime;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SampleCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $movies = [
            ['title' => 'Midnight at Orion', 'rating' => '8.6'],
            ['title' => 'The Last Lighthouse', 'rating' => '8.2'],
            ['title' => 'Paper Moons', 'rating' => '7.9'],
            ['title' => 'Echoes of Tomorrow', 'rating' => '8.4'],
            ['title' => 'The Clockwork Garden', 'rating' => '8.1'],
        ];

        DB::transaction(function () use ($movies): void {
            $hall = CinemaHall::query()->firstOrCreate(['hall_number' => 'Demo 1']);

            foreach (range('A', 'D') as $row) {
                foreach (range(1, 8) as $seatNumber) {
                    $hall->seats()->firstOrCreate(['seat_code' => "{$row}{$seatNumber}"]);
                }
            }

            $firstScreeningDay = now()->startOfDay()->addDay();
            $showtimeHours = [13, 15, 17, 19, 21];

            foreach ($movies as $index => $movieData) {
                $movie = Movie::query()->firstOrCreate(
                    ['title' => $movieData['title']],
                    ['rating' => $movieData['rating']],
                );

                foreach (range(0, 2) as $dayOffset) {
                    Showtime::query()->firstOrCreate(
                        [
                            'cinema_hall_id' => $hall->id,
                            'showtime_start' => $firstScreeningDay->copy()
                                ->addDays($dayOffset)
                                ->setTime($showtimeHours[$index], 0),
                        ],
                        ['movie_id' => $movie->id],
                    );
                }
            }
        });
    }
}
