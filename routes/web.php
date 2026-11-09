<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\MovieBookingController;
use App\Http\Controllers\ShowtimeController;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::get('showtimes/create', [ShowtimeController::class, 'create'])->name('showtimes.create');
    Route::get('showtimes', [ShowtimeController::class, 'index'])->name('showtimes.index');
    Route::post('showtimes', [ShowtimeController::class, 'store'])->name('showtimes.store');
    Route::put('showtimes/{id}', [ShowtimeController::class, 'update'])->name('showtimes.update');
    Route::patch('showtimes/{id}', [ShowtimeController::class, 'update']);
    Route::post('movies', [ShowtimeController::class, 'storeMovie'])->name('movies.store');
    Route::put('movies/{id}', [ShowtimeController::class, 'updateMovie'])->name('movies.update');
    Route::post('cinema-halls', [ShowtimeController::class, 'storeCinemaHall'])->name('cinema-halls.store');
    Route::put('cinema-halls/{id}', [ShowtimeController::class, 'updateCinemaHall'])->name('cinema-halls.update');

    Route::get('movie-bookings/create', [MovieBookingController::class, 'create'])->name('movie-bookings.create');
    Route::get('movie-bookings', [MovieBookingController::class, 'index'])->name('movie-bookings.index');
    Route::post('movie-bookings', [MovieBookingController::class, 'store'])->name('movie-bookings.store');
    Route::put('movie-bookings/{id}', [MovieBookingController::class, 'update'])->name('movie-bookings.update');
    Route::patch('movie-bookings/{id}', [MovieBookingController::class, 'update']);
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
