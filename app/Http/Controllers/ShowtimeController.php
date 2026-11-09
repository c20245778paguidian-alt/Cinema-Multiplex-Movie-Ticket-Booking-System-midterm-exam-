<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreShowtimeRequest;
use App\Http\Requests\StoreMovieRequest;
use App\Http\Requests\StoreCinemaHallRequest;
use App\Http\Requests\UpdateMovieRequest;
use App\Http\Requests\UpdateCinemaHallRequest;
use App\Http\Requests\UpdateShowtimeRequest;
use App\Models\CinemaHall;
use App\Models\Movie;
use App\Models\Showtime;
use App\Services\CinemaBookingService;
use Illuminate\Http\JsonResponse;

class ShowtimeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            Showtime::query()
                ->with(['movie', 'cinemaHall'])
                ->where('showtime_start', '>=', now())
                ->orderBy('showtime_start')
                ->paginate(15)
        );
    }

    public function create(): JsonResponse
    {
        return response()->json([
            'movies' => Movie::query()->orderBy('title')->get(),
            'cinema_halls' => CinemaHall::query()->with('seats')->orderBy('hall_number')->get(),
        ]);
    }

    public function storeMovie(StoreMovieRequest $request, CinemaBookingService $service): JsonResponse
    {
        return response()->json($service->createMovie($request->validated()), 201);
    }

    public function storeCinemaHall(StoreCinemaHallRequest $request, CinemaBookingService $service): JsonResponse
    {
        return response()->json($service->createCinemaHall($request->validated()), 201);
    }

    public function updateMovie(string $id, UpdateMovieRequest $request, CinemaBookingService $service): JsonResponse
    {
        return response()->json(
            $service->updateMovie(Movie::query()->findOrFail($id), $request->validated()),
        );
    }

    public function updateCinemaHall(string $id, UpdateCinemaHallRequest $request, CinemaBookingService $service): JsonResponse
    {
        return response()->json(
            $service->updateCinemaHall(CinemaHall::query()->findOrFail($id), $request->validated()),
        );
    }

    public function store(StoreShowtimeRequest $request, CinemaBookingService $service): JsonResponse
    {
        $showtime = $service->createShowtime($request->validated());

        return response()->json($showtime->load(['movie', 'cinemaHall']), 201);
    }

    public function update(
        UpdateShowtimeRequest $request,
        string $id,
        CinemaBookingService $service,
    ): JsonResponse {
        $showtime = $service->updateShowtime(
            Showtime::query()->findOrFail($id),
            $request->validated(),
        );

        return response()->json($showtime->load(['movie', 'cinemaHall']));
    }
}
