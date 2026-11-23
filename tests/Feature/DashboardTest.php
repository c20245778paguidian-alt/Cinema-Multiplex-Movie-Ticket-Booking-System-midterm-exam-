<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $this->get('/dashboard')->assertRedirect('/login');
    }

    public function test_authenticated_users_can_visit_the_dashboard()
    {
        $this->actingAs($user = User::factory()->create());

        $this->get('/dashboard')->assertOk();
    }

    public function test_authenticated_users_can_open_the_main_cinema_pages()
    {
        $this->actingAs(User::factory()->create());

        $this->get('/movies')->assertOk();
        $this->get('/booking')->assertOk();
        $this->get('/payment')->assertOk();
    }
}
