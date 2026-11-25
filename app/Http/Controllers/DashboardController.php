<?php

namespace App\Http\Controllers;

use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function stats(DashboardService $service): JsonResponse
    {
        return response()->json($service->getStats());
    }
}
