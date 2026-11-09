<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MovieBooking extends Model
{
    use HasFactory;

    protected $primaryKey = 'booking_id';

    protected $fillable = [
        'customer_email',
        'showtime_id',
        'seat_id',
        'ticket_type',
        'total_amount',
        'payment_status',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
        ];
    }

    public function showtime(): BelongsTo
    {
        return $this->belongsTo(Showtime::class);
    }

    public function seat(): BelongsTo
    {
        return $this->belongsTo(Seat::class);
    }
}
