<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Showtime extends Model
{
    use HasFactory;

    protected $fillable = [
        'movie_id',
        'cinema_hall_id',
        'showtime_start',
    ];

    protected function casts(): array
    {
        return [
            'showtime_start' => 'datetime',
        ];
    }

    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }

    public function cinemaHall(): BelongsTo
    {
        return $this->belongsTo(CinemaHall::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(MovieBooking::class);
    }
}
