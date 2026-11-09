<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Seat extends Model
{
    use HasFactory;

    protected $fillable = [
        'cinema_hall_id',
        'seat_code',
    ];

    public function cinemaHall(): BelongsTo
    {
        return $this->belongsTo(CinemaHall::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(MovieBooking::class);
    }
}
