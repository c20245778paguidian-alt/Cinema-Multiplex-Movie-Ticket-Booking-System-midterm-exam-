<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('movie_bookings', function (Blueprint $table) {
            $table->string('payment_method', 30)->nullable()->after('ticket_type');
        });
    }

    public function down(): void
    {
        Schema::table('movie_bookings', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });
    }
};