<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('movie_bookings', function (Blueprint $table) {
            $table->id('booking_id');
            $table->string('customer_email')->index();
            $table->foreignId('showtime_id')->constrained()->restrictOnDelete();
            $table->foreignId('seat_id')->constrained()->restrictOnDelete();
            $table->string('ticket_type', 30);
            $table->decimal('total_amount', 10, 2);
            $table->string('payment_status', 20)->default('pending');
            $table->timestamps();

            $table->unique(['showtime_id', 'seat_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movie_bookings');
    }
};
