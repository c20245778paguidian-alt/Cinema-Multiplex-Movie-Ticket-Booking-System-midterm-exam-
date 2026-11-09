<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CinemaHall extends Model
{
    use HasFactory;

    protected $fillable = [
        'hall_number',
    ];

    public function showtimes(): HasMany
    {
        return $this->hasMany(Showtime::class);
    }

    public function seats(): HasMany
    {
        return $this->hasMany(Seat::class);
    }
}
