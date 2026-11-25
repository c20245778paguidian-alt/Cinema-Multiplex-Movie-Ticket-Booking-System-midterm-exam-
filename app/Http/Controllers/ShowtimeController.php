<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreShowtimeRequest;
use App\Http\Requests\UpdateShowtimeRequest;
use App\Models\Showtime;
use App\Services\ShowtimeService;
use Illuminate\Http\JsonResponse;

class ShowtimeController extends Controller
{
    public function index(ShowtimeService $service): JsonResponse
    {
        return response()->json($service->getShowtimes());
    }

    public function create(ShowtimeService $service): JsonResponse
    {
        return response()->json($service->getCreateData());
    }

    public function store(StoreShowtimeRequest $request, ShowtimeService $service): JsonResponse
    {
        return response()->json($service->createShowtime($request->validated()), 201);
    }

    public function update(
        UpdateShowtimeRequest $request,
        Showtime $showtime,
        ShowtimeService $service,
    ): JsonResponse {
        return response()->json($service->updateShowtime($showtime, $request->validated()));
    }
}
