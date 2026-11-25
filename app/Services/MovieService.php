<?php

namespace App\Services;

use App\Models\Movie;
use Illuminate\Support\Facades\DB;

class MovieService
{
    public function create(array $data): Movie
    {
        return DB::transaction(fn () => Movie::create($data));
    }

    public function update(Movie $movie, array $data): Movie
    {
        return DB::transaction(function () use ($movie, $data) {
            $movie = Movie::query()->lockForUpdate()->findOrFail($movie->id);
            $movie->update($data);

            return $movie->refresh();
        });
    }

    public function delete(Movie $movie): bool
    {
        return DB::transaction(function () use ($movie) {
            $movie = Movie::query()->lockForUpdate()->findOrFail($movie->id);

            if ($movie->showtimes()->exists()) {
                return false;
            }

            $movie->delete();

            return true;
        });
    }
}
