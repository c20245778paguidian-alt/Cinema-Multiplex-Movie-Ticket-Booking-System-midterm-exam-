<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreMovieRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'rating' => ['required', 'string', 'max:10'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Enter a movie title.',
            'rating.required' => 'Choose a movie rating.',
        ];
    }
}
