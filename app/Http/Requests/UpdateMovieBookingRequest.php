<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMovieBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('customer_email')) {
            $this->merge([
                'customer_email' => strtolower(trim(strip_tags((string) $this->input('customer_email')))),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'customer_email' => ['sometimes', 'required', 'email', 'max:255'],
            'showtime_id' => ['sometimes', 'required', 'integer', 'exists:showtimes,id'],
            'seat_id' => ['sometimes', 'required', 'integer', 'exists:seats,id'],
            'ticket_type' => ['sometimes', 'required', 'string', Rule::in(array_keys(config('cinema.ticket_types')))],
            'payment_status' => ['sometimes', 'required', 'string', Rule::in(config('cinema.payment_statuses'))],
        ];
    }

    public function messages(): array
    {
        return [
            'customer_email.email' => 'Enter a valid customer email address.',
            'showtime_id.exists' => 'Select an existing showtime.',
            'seat_id.exists' => 'Select an existing seat.',
            'ticket_type.in' => 'Select a supported ticket type.',
            'payment_status.in' => 'Select a supported payment status.',
        ];
    }
}
