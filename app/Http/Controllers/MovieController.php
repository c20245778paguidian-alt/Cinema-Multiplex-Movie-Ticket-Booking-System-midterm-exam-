<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMovieRequest;
use App\Http\Requests\UpdateMovieRequest;
use App\Models\Movie;
use App\Services\MovieService;
use Illuminate\Http\JsonResponse;

class MovieController extends Controller
{
    public function store(StoreMovieRequest $request, MovieService $service): JsonResponse
    {
        return response()->json($service->create($request->validated()), 201);
    }

    public function update(
        UpdateMovieRequest $request,
        Movie $movie,
        MovieService $service,
    ): JsonResponse {
        return response()->json($service->update($movie, $request->validated()));
    }

    public function destroy(Movie $movie, MovieService $service): JsonResponse
    {
        if (! $service->delete($movie)) {
            return response()->json([
                'message' => 'This movie has scheduled showtimes and cannot be deleted.',
            ], 422);
        }

        return response()->json(['message' => 'Movie deleted.']);
    }
}
