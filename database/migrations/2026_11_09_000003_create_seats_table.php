<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cinema_hall_id')->constrained()->restrictOnDelete();
            $table->string('seat_code', 10);
            $table->timestamps();

            $table->unique(['cinema_hall_id', 'seat_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seats');
    }
};
