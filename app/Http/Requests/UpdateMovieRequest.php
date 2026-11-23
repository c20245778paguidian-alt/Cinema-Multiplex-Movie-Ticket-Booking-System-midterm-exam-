<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMovieRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $normalized = [];

        foreach (['title', 'rating'] as $field) {
            $value = $this->input($field);
            if (is_string($value)) {
                $normalized[$field] = trim(strip_tags($value));
            }
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
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'rating' => ['sometimes', 'required', 'string', 'max:10', 'regex:/^\d+(?:\.\d+)?$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Enter a movie title.',
            'rating.required' => 'Choose a movie rating.',
            'rating.regex' => 'Rating must contain numbers only; decimals are allowed.',
        ];
    }
}
