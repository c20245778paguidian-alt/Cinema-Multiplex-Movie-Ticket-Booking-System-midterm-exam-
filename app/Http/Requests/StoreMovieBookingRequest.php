<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMovieBookingRequest extends FormRequest
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
            'customer_email' => ['required', 'email', 'max:255'],
            'showtime_id' => ['required', 'integer', 'exists:showtimes,id'],
            'seat_id' => ['required', 'integer', 'exists:seats,id'],
            'ticket_type' => ['required', 'string', Rule::in(array_keys(config('cinema.ticket_types')))],
            'payment_method' => ['sometimes', 'required', 'string', Rule::in(['card', 'ewallet', 'cash'])],
            'payment_status' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'customer_email.email' => 'Enter a valid customer email address.',
            'showtime_id.exists' => 'Select an existing showtime.',
            'seat_id.exists' => 'Select an existing seat.',
            'ticket_type.in' => 'Select a supported ticket type.',
            'payment_method.in' => 'Select a supported payment method.',
            'payment_status.prohibited' => 'New bookings must remain pending until payment is confirmed.',
        ];
    }
}
