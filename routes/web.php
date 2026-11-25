<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\CinemaHallController;
use App\Http\Controllers\MovieController;
use App\Http\Controllers\MovieBookingController;
use App\Http\Controllers\ShowtimeController;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');
    Route::get('dashboard/stats', [DashboardController::class, 'stats'])->name('dashboard.stats');
    Route::get('movies', fn () => Inertia::render('movies'))->name('movies.index');
    Route::get('booking', fn () => Inertia::render('booking'))->name('booking.create');
    Route::get('payment', fn () => Inertia::render('payment'))->name('payment.create');

    Route::get('showtimes/create', [ShowtimeController::class, 'create'])->name('showtimes.create');
    Route::get('showtimes', [ShowtimeController::class, 'index'])->name('showtimes.index');
    Route::post('showtimes', [ShowtimeController::class, 'store'])->name('showtimes.store');
    Route::put('showtimes/{showtime}', [ShowtimeController::class, 'update'])->name('showtimes.update');
    Route::patch('showtimes/{showtime}', [ShowtimeController::class, 'update']);
    Route::post('movies', [MovieController::class, 'store'])->name('movies.store');
    Route::put('movies/{movie}', [MovieController::class, 'update'])->name('movies.update');
    Route::delete('movies/{movie}', [MovieController::class, 'destroy'])->name('movies.destroy');
    Route::post('cinema-halls', [CinemaHallController::class, 'store'])->name('cinema-halls.store');
    Route::put('cinema-halls/{cinemaHall}', [CinemaHallController::class, 'update'])->name('cinema-halls.update');

    Route::get('movie-bookings/create', [MovieBookingController::class, 'create'])->name('movie-bookings.create');
    Route::get('movie-bookings', [MovieBookingController::class, 'index'])->name('movie-bookings.index');
    Route::post('movie-bookings', [MovieBookingController::class, 'store'])->name('movie-bookings.store');
    Route::get('movie-bookings/{booking}', [MovieBookingController::class, 'show'])->name('movie-bookings.show');
    Route::put('movie-bookings/{booking}', [MovieBookingController::class, 'update'])->name('movie-bookings.update');
    Route::patch('movie-bookings/{booking}', [MovieBookingController::class, 'update']);
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
