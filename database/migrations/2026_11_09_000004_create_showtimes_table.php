<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('showtimes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('movie_id')->constrained()->restrictOnDelete();
            $table->foreignId('cinema_hall_id')->constrained()->restrictOnDelete();
            $table->dateTime('showtime_start')->index();
            $table->timestamps();

            $table->unique(['cinema_hall_id', 'showtime_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('showtimes');
    }
};
