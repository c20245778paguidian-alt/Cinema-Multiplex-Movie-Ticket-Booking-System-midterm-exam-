<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class ProfileService
{
    public function update(User $user, array $data): void
    {
        DB::transaction(function () use ($user, $data) {
            $user = User::query()->lockForUpdate()->findOrFail($user->id);
            $user->fill($data);

            if ($user->isDirty('email')) {
                $user->email_verified_at = null;
            }

            $user->save();
        });
    }

    public function delete(User $user): void
    {
        DB::transaction(function () use ($user) {
            User::query()->lockForUpdate()->findOrFail($user->id)->delete();
        });
    }
}
