<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\EmailVerificationService;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\RedirectResponse;

class VerifyEmailController extends Controller
{
    /**
     * Mark the authenticated user's email address as verified.
     */
    public function __invoke(
        EmailVerificationRequest $request,
        EmailVerificationService $service,
    ): RedirectResponse
    {
        $service->verify($request->user());

        return redirect()->intended(route('dashboard', absolute: false).'?verified=1');
    }
}
