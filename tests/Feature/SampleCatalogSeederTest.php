<?php

namespace Tests\Feature;

use App\Models\Movie;
use App\Models\Showtime;
use App\Models\User;
use Database\Seeders\SampleCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SampleCatalogSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_sample_catalog_seeder_creates_bookable_choices_and_is_idempotent(): void
    {
        $seeder = new SampleCatalogSeeder;
        $seeder->run();

        $this->assertDatabaseCount('movies', 5);
        $this->assertDatabaseCount('cinema_halls', 1);
        $this->assertDatabaseCount('seats', 32);
        $this->assertDatabaseCount('showtimes', 15);
        $this->assertSame(15, Showtime::query()->where('showtime_start', '>', now())->count());

        $this->actingAs(User::factory()->create())
            ->getJson('/movie-bookings/create')
            ->assertOk()
            ->assertJsonCount(15, 'showtimes')
            ->assertJsonCount(32, 'showtimes.0.cinema_hall.seats');

        $seeder->run();

        $this->assertDatabaseCount('movies', 5);
        $this->assertDatabaseCount('cinema_halls', 1);
        $this->assertDatabaseCount('seats', 32);
        $this->assertDatabaseCount('showtimes', 15);
    }
}
