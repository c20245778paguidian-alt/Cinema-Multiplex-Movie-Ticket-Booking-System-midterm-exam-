<?php

namespace App\Http\Controllers;

use App\Http\Requests\IndexMovieBookingRequest;
use App\Http\Requests\StoreMovieBookingRequest;
use App\Http\Requests\UpdateMovieBookingRequest;
use App\Models\MovieBooking;
use App\Services\MovieBookingService;
use Illuminate\Http\JsonResponse;

class MovieBookingController extends Controller
{
    public function index(IndexMovieBookingRequest $request, MovieBookingService $service): JsonResponse
    {
        return response()->json($service->getBookings($request->validated('search')));
    }

    public function create(MovieBookingService $service): JsonResponse
    {
        return response()->json($service->getCreateData());
    }

    public function show(MovieBooking $booking, MovieBookingService $service): JsonResponse
    {
        return response()->json($service->getBooking($booking));
    }

    public function store(StoreMovieBookingRequest $request, MovieBookingService $service): JsonResponse
    {
        return response()->json($service->createMovieBooking($request->validated()), 201);
    }

    public function update(
        UpdateMovieBookingRequest $request,
        MovieBooking $booking,
        MovieBookingService $service,
    ): JsonResponse {
        return response()->json($service->updateMovieBooking($booking, $request->validated()));
    }
}
