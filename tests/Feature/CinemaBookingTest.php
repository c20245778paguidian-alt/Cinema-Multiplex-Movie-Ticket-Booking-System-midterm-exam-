<?php

namespace Tests\Feature;

use App\Models\CinemaHall;
use App\Models\Movie;
use App\Models\MovieBooking;
use App\Models\Seat;
use App\Models\Showtime;
use App\Models\User;
use App\Services\CinemaBookingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CinemaBookingTest extends TestCase
{
    use RefreshDatabase;

    public function test_booking_normalizes_email_prices_ticket_and_prevents_duplicate_seat_reservations(): void
    {
        $this->actingAs(User::factory()->create());
        [$showtime, $seat] = $this->makeShowtimeAndSeat();

        $payload = [
            'customer_email' => '  <b>Customer@Example.COM</b> ',
            'showtime_id' => $showtime->id,
            'seat_id' => $seat->id,
            'ticket_type' => 'standard',
        ];

        $this->postJson('/movie-bookings', $payload)
            ->assertCreated()
            ->assertJsonPath('customer_email', 'customer@example.com')
            ->assertJsonPath('total_amount', '250.00');

        $this->postJson('/movie-bookings', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('seat_id');

        $this->assertDatabaseCount('movie_bookings', 1);
    }

    public function test_booking_update_recalculates_price_and_showtime_resources_eager_load_relations(): void
    {
        $this->actingAs(User::factory()->create());
        [$showtime, $seat] = $this->makeShowtimeAndSeat();
        $booking = app(\App\Services\CinemaBookingService::class)->createMovieBooking([
            'customer_email' => 'before@example.com',
            'showtime_id' => $showtime->id,
            'seat_id' => $seat->id,
            'ticket_type' => 'standard',
        ]);

        $this->putJson("/movie-bookings/{$booking->booking_id}", [
            'customer_email' => 'New@Example.COM',
            'ticket_type' => 'student',
        ])
            ->assertOk()
            ->assertJsonPath('customer_email', 'new@example.com')
            ->assertJsonPath('total_amount', '200.00');

        $this->getJson('/showtimes')
            ->assertOk()
            ->assertJsonPath('data.0.movie.title', 'Test Movie')
            ->assertJsonPath('data.0.cinema_hall.hall_number', 'A1');

        $this->assertDatabaseHas('movie_bookings', [
            'booking_id' => $booking->booking_id,
            'total_amount' => 200.00,
        ]);
    }

    public function test_booking_rejects_a_seat_from_another_hall(): void
    {
        $this->actingAs(User::factory()->create());
        [$showtime] = $this->makeShowtimeAndSeat();
        $otherHall = CinemaHall::create(['hall_number' => 'B2']);
        $otherSeat = Seat::create([
            'cinema_hall_id' => $otherHall->id,
            'seat_code' => 'B1',
        ]);

        $this->postJson('/movie-bookings', [
            'customer_email' => 'customer@example.com',
            'showtime_id' => $showtime->id,
            'seat_id' => $otherSeat->id,
            'ticket_type' => 'standard',
        ])->assertUnprocessable()->assertJsonValidationErrors('seat_id');

        $this->assertDatabaseCount('movie_bookings', 0);
    }

    public function test_catalog_can_be_created_with_movies_halls_and_seats(): void
    {
        $this->actingAs(User::factory()->create());

        $this->postJson('/movies', [
            'title' => '  <b>New Film</b> ',
            'rating' => ' PG-13 ',
        ])->assertCreated()
            ->assertJsonPath('title', 'New Film')
            ->assertJsonPath('rating', 'PG-13');

        $this->postJson('/cinema-halls', [
            'hall_number' => '  Hall A ',
            'seat_codes' => [' a1 ', 'a2', 'B1'],
        ])->assertCreated()
            ->assertJsonPath('hall_number', 'Hall A')
            ->assertJsonPath('seats.0.seat_code', 'A1')
            ->assertJsonCount(3, 'seats');

        $this->assertDatabaseCount('movies', 1);
        $this->assertDatabaseCount('cinema_halls', 1);
        $this->assertDatabaseCount('seats', 3);
    }

    public function test_catalog_rejects_seat_codes_that_collide_after_normalization(): void
    {
        $this->actingAs(User::factory()->create());

        $this->postJson('/cinema-halls', [
            'hall_number' => 'Hall A',
            'seat_codes' => [' a1 ', 'A1'],
        ])->assertUnprocessable()->assertJsonValidationErrors('seat_codes.0');

        $this->assertDatabaseCount('cinema_halls', 0);
    }

    public function test_movie_and_hall_catalog_records_can_be_edited(): void
    {
        $this->actingAs(User::factory()->create());
        $movie = Movie::create(['title' => 'Old Title', 'rating' => 'G']);
        $hall = app(CinemaBookingService::class)->createCinemaHall([
            'hall_number' => 'Old Hall',
            'seat_codes' => ['A1', 'A2'],
        ]);

        $this->putJson("/movies/{$movie->id}", [
            'title' => '  <b>New Title</b> ',
            'rating' => ' PG-13 ',
        ])->assertOk()
            ->assertJsonPath('title', 'New Title')
            ->assertJsonPath('rating', 'PG-13');

        $this->putJson("/cinema-halls/{$hall->id}", [
            'hall_number' => '  Hall B ',
            'seat_codes' => ['A2', 'B1'],
        ])->assertOk()
            ->assertJsonPath('hall_number', 'Hall B')
            ->assertJsonCount(2, 'seats');

        $this->assertDatabaseHas('seats', ['cinema_hall_id' => $hall->id, 'seat_code' => 'B1']);
        $this->assertDatabaseMissing('seats', ['cinema_hall_id' => $hall->id, 'seat_code' => 'A1']);
    }

    public function test_hall_edit_cannot_remove_a_reserved_seat(): void
    {
        $this->actingAs(User::factory()->create());
        [$showtime, $seat] = $this->makeShowtimeAndSeat();
        $hall = CinemaHall::query()->with('seats')->findOrFail($seat->cinema_hall_id);
        $hall->seats()->create(['seat_code' => 'A2']);
        app(CinemaBookingService::class)->createMovieBooking([
            'customer_email' => 'customer@example.com',
            'showtime_id' => $showtime->id,
            'seat_id' => $seat->id,
            'ticket_type' => 'standard',
        ]);

        $this->putJson("/cinema-halls/{$hall->id}", [
            'seat_codes' => ['A2'],
        ])->assertUnprocessable()->assertJsonValidationErrors('seat_codes');

        $this->assertDatabaseHas('seats', ['id' => $seat->id]);
    }

    public function test_showtime_edit_can_change_movie_hall_and_start_time(): void
    {
        $this->actingAs(User::factory()->create());
        [$showtime] = $this->makeShowtimeAndSeat();
        $movie = Movie::create(['title' => 'Second Movie', 'rating' => 'PG']);
        $hall = app(CinemaBookingService::class)->createCinemaHall([
            'hall_number' => 'B2',
            'seat_codes' => ['B1'],
        ]);

        $this->putJson("/showtimes/{$showtime->id}", [
            'movie_id' => $movie->id,
            'cinema_hall_id' => $hall->id,
            'showtime_start' => '2026-12-01 20:00:00',
        ])->assertOk()
            ->assertJsonPath('movie.id', $movie->id)
            ->assertJsonPath('cinema_hall.id', $hall->id);
    }

    public function test_booking_dependencies_include_reservations_so_the_ui_can_hide_taken_seats(): void
    {
        $this->actingAs(User::factory()->create());
        [$showtime, $seat] = $this->makeShowtimeAndSeat();
        app(CinemaBookingService::class)->createMovieBooking([
            'customer_email' => 'customer@example.com',
            'showtime_id' => $showtime->id,
            'seat_id' => $seat->id,
            'ticket_type' => 'standard',
        ]);

        $this->getJson('/movie-bookings/create')
            ->assertOk()
            ->assertJsonPath('showtimes.0.bookings.0.seat_id', $seat->id);
    }

    public function test_booking_search_filters_across_all_bookings(): void
    {
        $this->actingAs(User::factory()->create());
        [$showtime, $seat] = $this->makeShowtimeAndSeat();
        $secondSeat = Seat::create([
            'cinema_hall_id' => $seat->cinema_hall_id,
            'seat_code' => 'A2',
        ]);
        $service = app(CinemaBookingService::class);
        $service->createMovieBooking([
            'customer_email' => 'find-me@example.com',
            'showtime_id' => $showtime->id,
            'seat_id' => $seat->id,
            'ticket_type' => 'standard',
        ]);
        $service->createMovieBooking([
            'customer_email' => 'other@example.com',
            'showtime_id' => $showtime->id,
            'seat_id' => $secondSeat->id,
            'ticket_type' => 'standard',
        ]);

        $this->getJson('/movie-bookings?search=find-me')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.customer_email', 'find-me@example.com');
    }

    public function test_showtime_resources_create_and_update_showtimes(): void
    {
        $this->actingAs(User::factory()->create());
        [$showtime] = $this->makeShowtimeAndSeat();
        $hall = CinemaHall::query()->firstOrFail();

        $this->getJson('/showtimes/create')
            ->assertOk()
            ->assertJsonPath('movies.0.title', 'Test Movie')
            ->assertJsonPath('cinema_halls.0.hall_number', 'A1');

        $this->postJson('/showtimes', [
            'movie_id' => $showtime->movie_id,
            'cinema_hall_id' => $hall->id,
            'showtime_start' => '2026-12-01 21:00:00',
        ])->assertCreated();

        $this->putJson("/showtimes/{$showtime->id}", [
            'showtime_start' => '2026-12-01 20:00:00',
        ])->assertOk()->assertJsonPath(
            'showtime_start',
            \Illuminate\Support\Carbon::parse('2026-12-01 20:00:00', config('app.timezone'))
                ->utc()
                ->format('Y-m-d\TH:i:s.u\Z'),
        );
    }

    public function test_showtime_with_reservations_cannot_be_moved_to_another_hall(): void
    {
        $this->actingAs(User::factory()->create());
        [$showtime, $seat] = $this->makeShowtimeAndSeat();
        app(CinemaBookingService::class)->createMovieBooking([
            'customer_email' => 'customer@example.com',
            'showtime_id' => $showtime->id,
            'seat_id' => $seat->id,
            'ticket_type' => 'standard',
        ]);
        $otherHall = CinemaHall::create(['hall_number' => 'B2']);

        $this->putJson("/showtimes/{$showtime->id}", [
            'cinema_hall_id' => $otherHall->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('cinema_hall_id');

        $this->assertDatabaseHas('showtimes', [
            'id' => $showtime->id,
            'cinema_hall_id' => $seat->cinema_hall_id,
        ]);
    }

    /**
     * @return array{Showtime, Seat}
     */
    private function makeShowtimeAndSeat(): array
    {
        $hall = app(CinemaBookingService::class)->createCinemaHall(['hall_number' => ' A1 ']);
        $movie = Movie::create([
            'title' => 'Test Movie',
            'rating' => 'PG-13',
        ]);
        $seat = Seat::create([
            'cinema_hall_id' => $hall->id,
            'seat_code' => 'A1',
        ]);
        $showtime = Showtime::create([
            'movie_id' => $movie->id,
            'cinema_hall_id' => $hall->id,
            'showtime_start' => '2026-12-01 19:00:00',
        ]);

        return [$showtime, $seat];
    }
}
