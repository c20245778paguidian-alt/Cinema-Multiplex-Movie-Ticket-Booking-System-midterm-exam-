import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { formatCurrency, requestJson } from '@/lib/cinema-api';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Armchair, CalendarDays, Clock3, LoaderCircle, Ticket } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Movie = {
    id: number;
    title: string;
    rating: string;
};

type Seat = {
    id: number;
    seat_code: string;
};

type SeatReservation = {
    booking_id: number;
    seat_id: number;
};

type Showtime = {
    id: number;
    showtime_start: string;
    movie: Movie;
    cinema_hall: {
        hall_number: string;
        seats: Seat[];
    };
    bookings: SeatReservation[];
};

type BookingDependencies = {
    showtimes: Showtime[];
    ticket_types: Record<string, number>;
};

type CheckoutDraft = {
    customerEmail: string;
    showtimeId: number;
    seatId: number;
    ticketType: string;
    ticketPrice: number;
    serviceFee: number;
    movieTitle: string;
    movieRating: string;
    showtimeStart: string;
    hallNumber: string;
    seatCode: string;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Booking', href: '/booking' }];

function formatShowtime(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

function displayTicketType(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function Booking() {
    const pageUrl = usePage().url;
    const { auth } = usePage<SharedData>().props;
    const [dependencies, setDependencies] = useState<BookingDependencies | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [customerEmail, setCustomerEmail] = useState(auth.user.email);
    const [movieId, setMovieId] = useState(() => new URLSearchParams(pageUrl.split('?')[1] ?? '').get('movie_id') ?? '');
    const [showtimeId, setShowtimeId] = useState('');
    const [seatId, setSeatId] = useState('');
    const [ticketType, setTicketType] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const loadDependencies = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await requestJson<BookingDependencies>('/movie-bookings/create');
            setDependencies(data);
            setTicketType(Object.keys(data.ticket_types)[0] ?? '');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to load showtimes.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDependencies();
    }, [loadDependencies]);

    const upcomingShowtimes = useMemo(
        () => (dependencies?.showtimes ?? []).filter((showtime) => new Date(showtime.showtime_start).getTime() >= Date.now()),
        [dependencies],
    );
    const movies = useMemo(() => {
        const distinctMovies = new Map<number, Movie>();
        upcomingShowtimes.forEach((showtime) => distinctMovies.set(showtime.movie.id, showtime.movie));
        return Array.from(distinctMovies.values()).sort((first, second) => first.title.localeCompare(second.title));
    }, [upcomingShowtimes]);
    const movieShowtimes = upcomingShowtimes.filter((showtime) => String(showtime.movie.id) === movieId);
    const selectedShowtime = movieShowtimes.find((showtime) => String(showtime.id) === showtimeId);
    const reservedSeats = new Set((selectedShowtime?.bookings ?? []).map((booking) => booking.seat_id));
    const ticketPrice = ticketType ? (dependencies?.ticket_types[ticketType] ?? 0) : 0;

    function selectMovie(value: string) {
        setMovieId(value);
        setShowtimeId('');
        setSeatId('');
    }

    function selectShowtime(value: string) {
        setShowtimeId(value);
        setSeatId('');
    }

    function continueToPayment(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        if (!selectedShowtime || !seatId || !ticketType || !dependencies) {
            setError('Choose a showtime, available seat, and ticket type to continue.');
            return;
        }

        const selectedSeat = selectedShowtime.cinema_hall.seats.find((seat) => String(seat.id) === seatId);
        if (!selectedSeat) {
            setError('The selected seat is no longer available. Choose another seat.');
            return;
        }

        const draft: CheckoutDraft = {
            customerEmail,
            showtimeId: selectedShowtime.id,
            seatId: selectedSeat.id,
            ticketType,
            ticketPrice,
            serviceFee: 0,
            movieTitle: selectedShowtime.movie.title,
            movieRating: selectedShowtime.movie.rating,
            showtimeStart: selectedShowtime.showtime_start,
            hallNumber: selectedShowtime.cinema_hall.hall_number,
            seatCode: selectedSeat.seat_code,
        };

        sessionStorage.setItem('cinema-checkout', JSON.stringify(draft));
        setSubmitting(true);
        router.visit('/payment');
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Book a movie ticket" />
            <main className="bg-muted/20 min-h-full">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
                    <header>
                        <p className="text-muted-foreground text-sm font-medium">Choose your screening</p>
                        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Book a ticket</h1>
                        <p className="text-muted-foreground mt-2">Select a movie, showtime, and seat to review your booking.</p>
                    </header>

                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Booking could not continue</AlertTitle>
                            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <span>{error}</span>
                                <Button size="sm" variant="outline" onClick={() => void loadDependencies()}>
                                    Reload showtimes
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    {loading ? (
                        <Card>
                            <CardContent className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
                                <LoaderCircle className="size-4 animate-spin" />
                                Loading available screenings…
                            </CardContent>
                        </Card>
                    ) : movies.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center py-16 text-center">
                                <CalendarDays className="text-muted-foreground size-9" />
                                <h2 className="mt-4 text-lg font-semibold">No upcoming screenings</h2>
                                <p className="text-muted-foreground mt-1 text-sm">Please check back after new showtimes are scheduled.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <form onSubmit={continueToPayment} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                            <div className="flex flex-col gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>1. Choose a movie and showtime</CardTitle>
                                        <CardDescription>Only upcoming screenings can be booked.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid gap-4 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="booking-movie">Movie</Label>
                                            <select
                                                id="booking-movie"
                                                className="border-input bg-background focus:ring-ring h-10 w-full rounded-md border px-3 text-sm focus:ring-2 focus:outline-none"
                                                value={movieId}
                                                onChange={(event) => selectMovie(event.target.value)}
                                                required
                                            >
                                                <option value="">Select a movie</option>
                                                {movies.map((movie) => (
                                                    <option key={movie.id} value={movie.id}>
                                                        {movie.title} ({movie.rating})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="booking-showtime">Showtime</Label>
                                            <select
                                                id="booking-showtime"
                                                className="border-input bg-background focus:ring-ring h-10 w-full rounded-md border px-3 text-sm focus:ring-2 focus:outline-none"
                                                value={showtimeId}
                                                onChange={(event) => selectShowtime(event.target.value)}
                                                disabled={!movieId || movieShowtimes.length === 0}
                                                required
                                            >
                                                <option value="">Select a showtime</option>
                                                {movieShowtimes.map((showtime) => (
                                                    <option key={showtime.id} value={showtime.id}>
                                                        {formatShowtime(showtime.showtime_start)} · Hall {showtime.cinema_hall.hall_number}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>2. Select your seat</CardTitle>
                                        <CardDescription>Unavailable seats are marked as booked.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {selectedShowtime ? (
                                            <>
                                                <div className="mx-auto mb-8 max-w-sm">
                                                    <div className="bg-muted text-muted-foreground border-primary/40 rounded-t-[50%] border-t-4 py-2 text-center text-xs font-medium tracking-[0.3em] uppercase">
                                                        Screen
                                                    </div>
                                                </div>
                                                {selectedShowtime.cinema_hall.seats.length ? (
                                                    <div className="flex flex-wrap justify-center gap-2">
                                                        {selectedShowtime.cinema_hall.seats.map((seat) => {
                                                            const booked = reservedSeats.has(seat.id);
                                                            const selected = String(seat.id) === seatId;

                                                            return (
                                                                <button
                                                                    key={seat.id}
                                                                    type="button"
                                                                    disabled={booked}
                                                                    aria-pressed={selected}
                                                                    aria-label={`Seat ${seat.seat_code}${booked ? ', booked' : selected ? ', selected' : ', available'}`}
                                                                    onClick={() => setSeatId(String(seat.id))}
                                                                    className={`flex size-12 flex-col items-center justify-center rounded-lg border text-xs font-medium transition-colors ${
                                                                        booked
                                                                            ? 'border-muted bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                                                                            : selected
                                                                              ? 'border-primary bg-primary text-primary-foreground'
                                                                              : 'border-border bg-background hover:border-primary hover:bg-primary/5'
                                                                    }`}
                                                                >
                                                                    <Armchair className="mb-0.5 size-3.5" />
                                                                    {seat.seat_code}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <p className="text-muted-foreground py-8 text-center text-sm">
                                                        No seats are configured for this hall.
                                                    </p>
                                                )}
                                                <div className="text-muted-foreground mt-6 flex flex-wrap justify-center gap-5 text-xs">
                                                    <span className="flex items-center gap-2">
                                                        <span className="bg-background size-3 rounded-sm border" /> Available
                                                    </span>
                                                    <span className="flex items-center gap-2">
                                                        <span className="bg-primary size-3 rounded-sm" /> Selected
                                                    </span>
                                                    <span className="flex items-center gap-2">
                                                        <span className="bg-muted size-3 rounded-sm" /> Booked
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-muted-foreground py-8 text-center text-sm">
                                                Choose a movie and showtime to view its seats.
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>3. Ticket details</CardTitle>
                                        <CardDescription>Enter the email address for this reservation.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid gap-5 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="customer-email">Customer email</Label>
                                            <Input
                                                id="customer-email"
                                                type="email"
                                                autoComplete="email"
                                                maxLength={255}
                                                value={customerEmail}
                                                onChange={(event) => setCustomerEmail(event.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="ticket-type">Ticket type</Label>
                                            <select
                                                id="ticket-type"
                                                className="border-input bg-background focus:ring-ring h-10 w-full rounded-md border px-3 text-sm focus:ring-2 focus:outline-none"
                                                value={ticketType}
                                                onChange={(event) => setTicketType(event.target.value)}
                                                required
                                            >
                                                {Object.entries(dependencies?.ticket_types ?? {}).map(([type, price]) => (
                                                    <option key={type} value={type}>
                                                        {displayTicketType(type)} · {formatCurrency(price)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="xl:sticky xl:top-6">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Ticket className="size-5" />
                                        Booking summary
                                    </CardTitle>
                                    <CardDescription>Your selection before checkout.</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-5">
                                    {selectedShowtime ? (
                                        <>
                                            <div>
                                                <p className="font-semibold">{selectedShowtime.movie.title}</p>
                                                <Badge variant="outline" className="mt-2">
                                                    {selectedShowtime.movie.rating}
                                                </Badge>
                                            </div>
                                            <div className="text-muted-foreground flex flex-col gap-3 text-sm">
                                                <p className="flex items-center gap-2">
                                                    <CalendarDays className="size-4" />
                                                    {formatShowtime(selectedShowtime.showtime_start)}
                                                </p>
                                                <p className="flex items-center gap-2">
                                                    <Clock3 className="size-4" />
                                                    Hall {selectedShowtime.cinema_hall.hall_number}
                                                </p>
                                                {seatId && (
                                                    <p className="flex items-center gap-2">
                                                        <Armchair className="size-4" />
                                                        Seat{' '}
                                                        {selectedShowtime.cinema_hall.seats.find((seat) => String(seat.id) === seatId)?.seat_code}
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-muted-foreground text-sm">Your movie and screening will appear here.</p>
                                    )}
                                    <div className="space-y-2 border-t pt-4 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">{ticketType ? displayTicketType(ticketType) : 'Ticket'}</span>
                                            <span>{formatCurrency(ticketPrice)}</span>
                                        </div>
                                        <div className="flex justify-between border-t pt-3 font-semibold">
                                            <span>Total</span>
                                            <span>{formatCurrency(ticketPrice)}</span>
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={!selectedShowtime || !seatId || !ticketType || submitting}>
                                        {submitting && <LoaderCircle className="animate-spin" />}
                                        Continue to payment
                                    </Button>
                                    <p className="text-muted-foreground text-center text-xs">No service fee is currently applied.</p>
                                </CardContent>
                            </Card>
                        </form>
                    )}
                </div>
            </main>
        </AppLayout>
    );
}
