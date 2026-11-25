<?php

namespace App\Services;

use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class PasswordResetService
{
    public function sendResetLink(string $email): string
    {
        return Password::sendResetLink(['email' => $email]);
    }

    public function resetPassword(array $credentials): string
    {
        $resetUser = null;
        $status = DB::transaction(function () use ($credentials, &$resetUser) {
            return Password::reset($credentials, function ($user) use ($credentials, &$resetUser) {
                $user->forceFill([
                    'password' => Hash::make($credentials['password']),
                    'remember_token' => Str::random(60),
                ])->save();

                $resetUser = $user;
            });
        });

        if ($status === Password::PasswordReset && $resetUser !== null) {
            event(new PasswordReset($resetUser));
        }

        return $status;
    }
}
