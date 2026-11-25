<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCinemaHallRequest;
use App\Http\Requests\UpdateCinemaHallRequest;
use App\Models\CinemaHall;
use App\Services\CinemaHallService;
use Illuminate\Http\JsonResponse;

class CinemaHallController extends Controller
{
    public function store(StoreCinemaHallRequest $request, CinemaHallService $service): JsonResponse
    {
        return response()->json($service->create($request->validated()), 201);
    }

    public function update(
        UpdateCinemaHallRequest $request,
        CinemaHall $cinemaHall,
        CinemaHallService $service,
    ): JsonResponse {
        return response()->json($service->update($cinemaHall, $request->validated()));
    }
}
