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
use Illuminate\Validation\ValidationException;
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
            'payment_method' => 'cash',
        ];

        $this->postJson('/movie-bookings', $payload)
            ->assertCreated()
            ->assertJsonPath('customer_email', 'customer@example.com')
            ->assertJsonPath('total_amount', '250.00')
            ->assertJsonPath('payment_method', 'cash');

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
            ->assertJsonPath('data.0.cinema_hall.hall_number', '1');

        $this->assertDatabaseHas('movie_bookings', [
            'booking_id' => $booking->booking_id,
            'total_amount' => 200.00,
        ]);
    }

    public function test_booking_rejects_a_seat_from_another_hall(): void
    {
        $this->actingAs(User::factory()->create());
        [$showtime] = $this->makeShowtimeAndSeat();
        $otherHall = CinemaHall::create(['hall_number' => '2']);
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

    public function test_new_booking_cannot_override_its_payment_status(): void
    {
        $this->actingAs(User::factory()->create());
        [$showtime, $seat] = $this->makeShowtimeAndSeat();

        $this->postJson('/movie-bookings', [
            'customer_email' => 'customer@example.com',
            'showtime_id' => $showtime->id,
            'seat_id' => $seat->id,
            'ticket_type' => 'standard',
            'payment_status' => 'paid',
        ])->assertUnprocessable()->assertJsonValidationErrors('payment_status');

        $this->assertDatabaseCount('movie_bookings', 0);
    }

    public function test_new_booking_rejects_past_showtimes(): void
    {
        $this->actingAs(User::factory()->create());
        [$showtime, $seat] = $this->makeShowtimeAndSeat();
        $showtime->update(['showtime_start' => now()->subDay()]);

        $this->postJson('/movie-bookings', [
            'customer_email' => 'customer@example.com',
            'showtime_id' => $showtime->id,
            'seat_id' => $seat->id,
            'ticket_type' => 'standard',
        ])->assertUnprocessable()->assertJsonValidationErrors('showtime_id');

        $this->assertDatabaseCount('movie_bookings', 0);
    }

    public function test_catalog_can_be_created_with_movies_halls_and_seats(): void
    {
        $this->actingAs(User::factory()->create());

        $this->postJson('/movies', [
            'title' => '  <b>New Film</b> ',
            'rating' => ' 8.5 ',
        ])->assertCreated()
            ->assertJsonPath('title', 'New Film')
            ->assertJsonPath('rating', '8.5');

        $this->postJson('/cinema-halls', [
            'hall_number' => ' 1 ',
            'seat_codes' => [' a1 ', 'a2', 'B1'],
        ])->assertCreated()
            ->assertJsonPath('hall_number', '1')
            ->assertJsonPath('seats.0.seat_code', 'A1')
            ->assertJsonCount(3, 'seats');

        $this->assertDatabaseCount('movies', 1);
        $this->assertDatabaseCount('cinema_halls', 1);
        $this->assertDatabaseCount('seats', 3);
    }

    public function test_hall_numbers_reject_letters_on_create_and_update(): void
    {
        $this->actingAs(User::factory()->create());

        $this->postJson('/cinema-halls', [
            'hall_number' => 'Hall 1',
            'seat_codes' => ['A1'],
        ])->assertUnprocessable()->assertJsonValidationErrors('hall_number');

        $hall = app(CinemaBookingService::class)->createCinemaHall([
            'hall_number' => '1',
            'seat_codes' => ['A1'],
        ]);

        $this->putJson("/cinema-halls/{$hall->id}", [
            'hall_number' => '2B',
        ])->assertUnprocessable()->assertJsonValidationErrors('hall_number');

        $this->assertDatabaseHas('cinema_halls', ['id' => $hall->id, 'hall_number' => '1']);
    }

    public function test_movies_can_be_deleted_unless_they_have_scheduled_showtimes(): void
    {
        $this->actingAs(User::factory()->create());
        $movie = Movie::create(['title' => 'Standalone Movie', 'rating' => '7.0']);

        $this->deleteJson("/movies/{$movie->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Movie deleted.');
        $this->assertDatabaseMissing('movies', ['id' => $movie->id]);

        [$showtime] = $this->makeShowtimeAndSeat();
        $this->deleteJson("/movies/{$showtime->movie_id}")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This movie has scheduled showtimes and cannot be deleted.');
        $this->assertDatabaseHas('movies', ['id' => $showtime->movie_id]);
    }

    public function test_movie_rating_rejects_letters_on_create_and_update(): void
    {
        $this->actingAs(User::factory()->create());
        $movie = Movie::create(['title' => 'Numeric Rating Movie', 'rating' => '7.5']);

        $this->postJson('/movies', [
            'title' => 'New Movie',
            'rating' => 'PG-13',
        ])->assertUnprocessable()->assertJsonValidationErrors('rating');

        $this->putJson("/movies/{$movie->id}", [
            'rating' => 'eight',
        ])->assertUnprocessable()->assertJsonValidationErrors('rating');

        $this->assertDatabaseHas('movies', ['id' => $movie->id, 'rating' => '7.5']);
    }

    public function test_booking_service_sanitizes_and_validates_direct_inputs(): void
    {
        $service = app(CinemaBookingService::class);
        $movie = $service->createMovie([
            'title' => '  <b>Clean Title</b> ',
            'rating' => ' 8.5 ',
            'unrecognized' => 'ignored',
        ]);

        $this->assertSame('Clean Title', $movie->title);
        $this->assertSame('8.5', $movie->rating);

        try {
            $service->createMovie([
                'title' => ['not', 'a', 'string'],
                'rating' => '8',
            ]);
            $this->fail('Invalid direct service input should fail validation.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('title', $exception->errors());
        }
    }

    public function test_booking_service_rejects_direct_payment_status_override(): void
    {
        [$showtime, $seat] = $this->makeShowtimeAndSeat();

        try {
            app(CinemaBookingService::class)->createMovieBooking([
                'customer_email' => 'customer@example.com',
                'showtime_id' => $showtime->id,
                'seat_id' => $seat->id,
                'ticket_type' => 'standard',
                'payment_status' => 'paid',
            ]);
            $this->fail('A new booking must not accept a payment status override.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('payment_status', $exception->errors());
        }

        $this->assertDatabaseCount('movie_bookings', 0);
    }

    public function test_dashboard_stats_cover_the_full_catalog_and_upcoming_seat_capacity(): void
    {
        $this->actingAs(User::factory()->create());
        [$showtime, $seat] = $this->makeShowtimeAndSeat();
        $showtime->cinemaHall->seats()->create(['seat_code' => 'A2']);
        $booking = app(CinemaBookingService::class)->createMovieBooking([
            'customer_email' => 'customer@example.com',
            'showtime_id' => $showtime->id,
            'seat_id' => $seat->id,
            'ticket_type' => 'standard',
        ]);
        $booking->update(['payment_status' => 'paid']);

        $pastShowtime = Showtime::create([
            'movie_id' => $showtime->movie_id,
            'cinema_hall_id' => $showtime->cinema_hall_id,
            'showtime_start' => now()->addDay(),
        ]);
        app(CinemaBookingService::class)->createMovieBooking([
            'customer_email' => 'past@example.com',
            'showtime_id' => $pastShowtime->id,
            'seat_id' => $seat->id,
            'ticket_type' => 'standard',
        ]);
        $pastShowtime->update(['showtime_start' => now()->subDay()]);

        $this->getJson('/dashboard/stats')
            ->assertOk()
            ->assertJsonPath('total_movies', 1)
            ->assertJsonPath('total_bookings', 2)
            ->assertJsonPath('available_seats', 1)
            ->assertJsonPath('total_revenue', 250);
    }

    public function test_catalog_rejects_seat_codes_that_collide_after_normalization(): void
    {
        $this->actingAs(User::factory()->create());

        $this->postJson('/cinema-halls', [
            'hall_number' => '1',
            'seat_codes' => [' a1 ', 'A1'],
        ])->assertUnprocessable()->assertJsonValidationErrors('seat_codes.1');

        $this->assertDatabaseCount('cinema_halls', 0);
    }

    public function test_movie_and_hall_catalog_records_can_be_edited(): void
    {
        $this->actingAs(User::factory()->create());
        $movie = Movie::create(['title' => 'Old Title', 'rating' => '6']);
        $hall = app(CinemaBookingService::class)->createCinemaHall([
            'hall_number' => '1',
            'seat_codes' => ['A1', 'A2'],
        ]);

        $this->putJson("/movies/{$movie->id}", [
            'title' => '  <b>New Title</b> ',
            'rating' => ' 8.5 ',
        ])->assertOk()
            ->assertJsonPath('title', 'New Title')
            ->assertJsonPath('rating', '8.5');

        $this->putJson("/cinema-halls/{$hall->id}", [
            'hall_number' => ' 2 ',
            'seat_codes' => ['A2', 'B1'],
        ])->assertOk()
            ->assertJsonPath('hall_number', '2')
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
        $movie = Movie::create(['title' => 'Second Movie', 'rating' => '7']);
        $hall = app(CinemaBookingService::class)->createCinemaHall([
            'hall_number' => '2',
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
            ->assertJsonPath('cinema_halls.0.hall_number', '1');

        $this->postJson('/showtimes', [
            'movie_id' => $showtime->movie_id,
            'cinema_hall_id' => $hall->id,
            'showtime_start' => '2026-12-01 21:00:00',
        ])->assertCreated();
        $this->postJson('/showtimes', [
            'movie_id' => $showtime->movie_id,
            'cinema_hall_id' => $hall->id,
            'showtime_start' => now()->subDay()->toISOString(),
        ])->assertUnprocessable()->assertJsonValidationErrors('showtime_start');

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
        $otherHall = CinemaHall::create(['hall_number' => '2']);

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
        $hall = app(CinemaBookingService::class)->createCinemaHall(['hall_number' => ' 1 ']);
        $movie = Movie::create([
            'title' => 'Test Movie',
            'rating' => '8.5',
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
