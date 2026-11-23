<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCinemaHallRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $normalized = [];
        $hallNumber = $this->input('hall_number');

        if (is_string($hallNumber)) {
            $normalized['hall_number'] = trim(strip_tags($hallNumber));
        }

        $seatCodes = $this->input('seat_codes');
        if (is_array($seatCodes)) {
            $normalized['seat_codes'] = array_map(
                fn ($seatCode) => is_string($seatCode)
                    ? strtoupper(trim(strip_tags($seatCode)))
                    : $seatCode,
                $seatCodes,
            );
        }

        $this->merge($normalized);
    }

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'hall_number' => ['sometimes', 'required', 'string', 'max:20', 'regex:/^\d+$/'],
            'seat_codes' => ['sometimes', 'required', 'array', 'min:1'],
            'seat_codes.*' => ['required', 'string', 'max:10', 'distinct:ignore_case'],
        ];
    }

    public function messages(): array
    {
        return [
            'hall_number.required' => 'Enter a hall number.',
            'hall_number.regex' => 'Hall number must contain digits only.',
            'seat_codes.required' => 'Add at least one seat code.',
            'seat_codes.*.distinct' => 'Seat codes must be unique within the hall.',
        ];
    }
}
