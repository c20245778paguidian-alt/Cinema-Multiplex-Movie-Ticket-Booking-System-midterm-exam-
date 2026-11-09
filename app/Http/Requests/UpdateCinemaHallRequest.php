<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCinemaHallRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'hall_number' => ['sometimes', 'required', 'string', 'max:20'],
            'seat_codes' => ['sometimes', 'required', 'array', 'min:1'],
            'seat_codes.*' => ['required', 'string', 'max:10', 'distinct:ignore_case'],
        ];
    }

    public function messages(): array
    {
        return [
            'hall_number.required' => 'Enter a hall number.',
            'seat_codes.required' => 'Add at least one seat code.',
            'seat_codes.*.distinct' => 'Seat codes must be unique within the hall.',
        ];
    }
}
