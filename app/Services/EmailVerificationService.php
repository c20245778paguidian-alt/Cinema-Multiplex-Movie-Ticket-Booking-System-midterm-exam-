<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Support\Facades\DB;

class EmailVerificationService
{
    public function verify(User $user): void
    {
        $verified = DB::transaction(function () use ($user) {
            $user = User::query()->lockForUpdate()->findOrFail($user->id);

            return ! $user->hasVerifiedEmail() && $user->markEmailAsVerified();
        });

        if ($verified) {
            event(new Verified($user));
        }
    }

    public function sendNotification(User $user): bool
    {
        if ($user->hasVerifiedEmail()) {
            return false;
        }

        $user->sendEmailVerificationNotification();

        return true;
    }
}
