<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreShowtimeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'movie_id' => ['required', 'integer', 'exists:movies,id'],
            'cinema_hall_id' => ['required', 'integer', 'exists:cinema_halls,id'],
            'showtime_start' => ['required', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'movie_id.exists' => 'Select an existing movie.',
            'cinema_hall_id.exists' => 'Select an existing cinema hall.',
            'showtime_start.date' => 'Enter a valid showtime date and time.',
        ];
    }
}
