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

function formatTime(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

function formatShortDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
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
    const selectedMovie = movies.find((movie) => String(movie.id) === movieId);
    const selectedShowtime = movieShowtimes.find((showtime) => String(showtime.id) === showtimeId);
    const reservedSeats = new Set((selectedShowtime?.bookings ?? []).map((booking) => booking.seat_id));
    const ticketPrice = ticketType ? (dependencies?.ticket_types[ticketType] ?? 0) : 0;
    const currentStep = !selectedMovie ? 1 : !selectedShowtime ? 2 : !seatId ? 3 : 4;
    const steps = ['Movie', 'Showtime', 'Seats', 'Payment'];

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
                        <p className="text-muted-foreground text-sm font-medium">Find your next screening</p>
                        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Book your seat</h1>
                        <p className="text-muted-foreground mt-2">Choose a movie and showtime, then select an available seat.</p>
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
                        <form onSubmit={continueToPayment} className="flex flex-col gap-6">
                            <Card>
                                <CardContent className="p-4 sm:p-6">
                                    <ol className="relative grid grid-cols-4 gap-2" aria-label="Booking progress">
                                        <li className="bg-border absolute top-4 right-[12.5%] left-[12.5%] h-0.5 list-none" aria-hidden="true" />
                                        {steps.map((step, index) => {
                                            const number = index + 1;
                                            const complete = number < currentStep;
                                            const active = number === currentStep;

                                            return (
                                                <li key={step} className="relative flex flex-col items-center gap-2 text-center">
                                                    <span
                                                        className={`relative z-10 flex size-9 items-center justify-center rounded-full border text-sm font-semibold ${
                                                            complete || active
                                                                ? 'border-primary bg-primary text-primary-foreground'
                                                                : 'border-border bg-background text-muted-foreground'
                                                        }`}
                                                        aria-current={active ? 'step' : undefined}
                                                    >
                                                        {number}
                                                    </span>
                                                    <span
                                                        className={`text-xs font-medium sm:text-sm ${active ? 'text-foreground' : 'text-muted-foreground'}`}
                                                    >
                                                        {step}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                </CardContent>
                            </Card>

                            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.8fr)]">
                                <div className="flex flex-col gap-6">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Movie and showtime</CardTitle>
                                            <CardDescription>Choose an upcoming screening to see its available seats.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="grid gap-5 sm:grid-cols-[140px_minmax(0,1fr)]">
                                            <div
                                                className="relative flex h-48 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-950 via-purple-800 to-fuchsia-500 shadow-md sm:h-56"
                                                aria-hidden="true"
                                            >
                                                <div className="absolute inset-2 rounded-lg border border-white/20" />
                                                <div className="text-center text-white">
                                                    <Ticket className="mx-auto size-10 opacity-90" />
                                                    <p className="mt-3 text-[10px] font-semibold tracking-[0.25em]">CINEMA</p>
                                                </div>
                                            </div>
                                            <div className="flex min-w-0 flex-col gap-5">
                                                <div>
                                                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                                                        Selected movie
                                                    </p>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                                        <h2 className="text-xl font-semibold">{selectedMovie?.title ?? 'Choose a movie'}</h2>
                                                        {selectedMovie && <Badge variant="outline">★ {selectedMovie.rating} / 10</Badge>}
                                                    </div>
                                                </div>

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
                                                    <p className="text-sm font-medium">Select Showtime</p>
                                                    {movieId && movieShowtimes.length === 0 ? (
                                                        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                                                            No upcoming showtimes are available for this movie.
                                                        </p>
                                                    ) : movieShowtimes.length ? (
                                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                            {movieShowtimes.map((showtime) => {
                                                                const selected = String(showtime.id) === showtimeId;

                                                                return (
                                                                    <button
                                                                        key={showtime.id}
                                                                        type="button"
                                                                        aria-pressed={selected}
                                                                        onClick={() => selectShowtime(String(showtime.id))}
                                                                        className={`flex min-h-16 flex-col items-center justify-center rounded-lg border px-2 py-2 text-center transition-colors ${
                                                                            selected
                                                                                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                                                                : 'border-border bg-background hover:border-primary/60 hover:bg-primary/5'
                                                                        }`}
                                                                    >
                                                                        <span className="text-sm font-semibold">
                                                                            {formatTime(showtime.showtime_start)}
                                                                        </span>
                                                                        <span
                                                                            className={`mt-0.5 text-xs ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
                                                                        >
                                                                            {formatShortDate(showtime.showtime_start)} · Hall{' '}
                                                                            {showtime.cinema_hall.hall_number}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                                                            Choose a movie to view its upcoming showtimes.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Select seats</CardTitle>
                                            <CardDescription>
                                                {selectedShowtime
                                                    ? `Hall ${selectedShowtime.cinema_hall.hall_number} · Select one available seat.`
                                                    : 'Select a showtime first to see the seat map.'}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {selectedShowtime ? (
                                                <>
                                                    <div className="mx-auto mb-8 max-w-lg">
                                                        <div className="border-primary/40 bg-muted/40 text-muted-foreground rounded-t-[50%] border-t-4 py-2 text-center text-xs font-medium tracking-[0.3em] uppercase">
                                                            Screen
                                                        </div>
                                                    </div>
                                                    {selectedShowtime.cinema_hall.seats.length ? (
                                                        <div className="mx-auto grid max-w-xl grid-cols-5 justify-items-center gap-2 sm:grid-cols-8 md:grid-cols-10">
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
                                                                        className={`flex size-11 flex-col items-center justify-center rounded-lg border text-[10px] font-medium transition-colors ${
                                                                            booked
                                                                                ? 'cursor-not-allowed border-slate-500 bg-slate-500 text-white opacity-75'
                                                                                : selected
                                                                                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                                                                  : 'border-primary/20 bg-background hover:border-primary hover:bg-primary/5'
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
                                                            <span className="border-primary/20 bg-background size-3 rounded-sm border" /> Available
                                                        </span>
                                                        <span className="flex items-center gap-2">
                                                            <span className="bg-primary size-3 rounded-sm" /> Selected
                                                        </span>
                                                        <span className="flex items-center gap-2">
                                                            <span className="size-3 rounded-sm bg-slate-500" /> Booked
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
                                </div>

                                <Card className="xl:sticky xl:top-6">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Ticket className="size-5" />
                                            Booking summary
                                        </CardTitle>
                                        <CardDescription>Review your selection before continuing to payment.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex flex-col gap-5">
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Movie</p>
                                            <p className="font-semibold">{selectedMovie?.title ?? 'Not selected'}</p>
                                            {selectedMovie && <Badge variant="outline">{selectedMovie.rating} / 10</Badge>}
                                        </div>

                                        <div className="text-muted-foreground flex flex-col gap-3 border-t pt-4 text-sm">
                                            <p className="flex items-center gap-2">
                                                <CalendarDays className="size-4 shrink-0" />
                                                {selectedShowtime ? formatShowtime(selectedShowtime.showtime_start) : 'Showtime not selected'}
                                            </p>
                                            {selectedShowtime && (
                                                <p className="flex items-center gap-2">
                                                    <Clock3 className="size-4 shrink-0" />
                                                    Hall {selectedShowtime.cinema_hall.hall_number}
                                                </p>
                                            )}
                                            {seatId && selectedShowtime && (
                                                <p className="flex items-center gap-2">
                                                    <Armchair className="size-4 shrink-0" />
                                                    Seat {selectedShowtime.cinema_hall.seats.find((seat) => String(seat.id) === seatId)?.seat_code}
                                                </p>
                                            )}
                                        </div>

                                        <div className="grid gap-4 border-t pt-4">
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
                                        </div>

                                        <div className="space-y-3 border-t pt-4 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">{ticketType ? displayTicketType(ticketType) : 'Ticket'}</span>
                                                <span>{formatCurrency(ticketPrice)}</span>
                                            </div>
                                            <div className="flex justify-between border-t pt-3 font-semibold">
                                                <span>Total price</span>
                                                <span>{formatCurrency(ticketPrice)}</span>
                                            </div>
                                        </div>
                                        <Button type="submit" className="w-full" disabled={!selectedShowtime || !seatId || !ticketType || submitting}>
                                            {submitting && <LoaderCircle className="animate-spin" />}
                                            Proceed to payment
                                        </Button>
                                        <p className="text-muted-foreground text-center text-xs">No service fee is currently applied.</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </form>
                    )}
                </div>
            </main>
        </AppLayout>
    );
}
