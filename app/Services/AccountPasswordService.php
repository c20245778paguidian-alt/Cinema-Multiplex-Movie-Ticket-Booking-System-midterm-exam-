<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AccountPasswordService
{
    public function update(User $user, string $password): void
    {
        DB::transaction(function () use ($user, $password) {
            User::query()->lockForUpdate()->findOrFail($user->id)->update([
                'password' => Hash::make($password),
            ]);
        });
    }
}
