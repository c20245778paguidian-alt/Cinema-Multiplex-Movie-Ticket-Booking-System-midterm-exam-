import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { CalendarDays, Clapperboard, Clock3, Film, LoaderCircle, LogOut, Plus, Search, Ticket, Users, Wallet } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

type Movie = {
    id: number;
    title: string;
    rating: string;
};

type Seat = {
    id: number;
    seat_code: string;
};

type CinemaHall = {
    id: number;
    hall_number: string;
    seats?: Seat[];
};

type SeatReservation = {
    booking_id: number;
    seat_id: number;
};

type Showtime = {
    id: number;
    showtime_start: string;
    movie: Movie;
    cinema_hall: CinemaHall;
    bookings?: SeatReservation[];
};

type MovieBooking = {
    booking_id: number;
    customer_email: string;
    ticket_type: string;
    total_amount: string;
    payment_status: string;
    created_at: string;
    showtime: Showtime;
    seat: Seat;
};

type Paginated<T> = {
    data: T[];
    total: number;
    current_page: number;
    last_page: number;
    next_page_url: string | null;
    prev_page_url: string | null;
};

type BookingDependencies = {
    showtimes: Showtime[];
    ticket_types: Record<string, number>;
    payment_statuses: string[];
};

type ShowtimeDependencies = {
    movies: Movie[];
    cinema_halls: CinemaHall[];
};

type DashboardData = {
    bookings: Paginated<MovieBooking>;
    showtimes: Paginated<Showtime>;
    bookingDependencies: BookingDependencies;
    showtimeDependencies: ShowtimeDependencies;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const xsrfCookie = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='));
    const headers = new Headers(init?.headers);
    headers.set('Accept', 'application/json');

    if (init?.body) {
        headers.set('Content-Type', 'application/json');
    }

    if (xsrfCookie) {
        headers.set('X-XSRF-TOKEN', decodeURIComponent(xsrfCookie.slice('XSRF-TOKEN='.length)));
    }

    const response = await fetch(url, {
        ...init,
        headers,
        credentials: 'same-origin',
    });

    let payload: unknown;

    try {
        payload = await response.json();
    } catch {
        throw new Error(`The server returned an unreadable response (${response.status}).`);
    }

    if (!response.ok) {
        const body = payload as { message?: string; errors?: Record<string, string[]> };
        const validationMessages = body.errors ? Object.values(body.errors).flat() : [];
        throw new Error(validationMessages[0] ?? body.message ?? `Request failed (${response.status}).`);
    }

    return payload as T;
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

function formatCurrency(value: number | string): string {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(Number(value));
}

function formatDateTimeLocal(value: string): string {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

    return date.toISOString().slice(0, 16);
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (status === 'paid') return 'default';
    if (status === 'failed' || status === 'refunded') return 'destructive';

    return 'secondary';
}

function MetricCard({
    label,
    value,
    note,
    icon: Icon,
    onClick,
}: {
    label: string;
    value: string;
    note: string;
    icon: typeof Ticket;
    onClick: () => void;
}) {
    return (
        <Card
            role="button"
            tabIndex={0}
            className="group border-border/70 hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-ring h-full cursor-pointer text-left shadow-none transition-colors focus-visible:ring-2"
            onClick={onClick}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClick();
                }
            }}
        >
            <CardContent className="flex items-start justify-between gap-4 p-5">
                <div>
                    <p className="text-muted-foreground text-sm font-medium">{label}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
                    <p className="text-muted-foreground mt-1 text-xs">{note}</p>
                </div>
                <div className="bg-primary/10 text-primary rounded-xl p-3">
                    <Icon className="size-5" />
                </div>
            </CardContent>
        </Card>
    );
}

export default function Dashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
    const [showtimeDialogOpen, setShowtimeDialogOpen] = useState(false);
    const [movieDialogOpen, setMovieDialogOpen] = useState(false);
    const [hallDialogOpen, setHallDialogOpen] = useState(false);
    const [resumeShowtimeAfterCatalog, setResumeShowtimeAfterCatalog] = useState(false);
    const [resumeBookingAfterShowtime, setResumeBookingAfterShowtime] = useState(false);
    const [editMovie, setEditMovie] = useState<Movie | null>(null);
    const [editHall, setEditHall] = useState<CinemaHall | null>(null);
    const [editBooking, setEditBooking] = useState<MovieBooking | null>(null);
    const [editShowtime, setEditShowtime] = useState<Showtime | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [bookingForm, setBookingForm] = useState({
        customer_email: '',
        showtime_id: '',
        seat_id: '',
        ticket_type: '',
    });
    const [showtimeForm, setShowtimeForm] = useState({
        movie_id: '',
        cinema_hall_id: '',
        showtime_start: '',
    });
    const [movieForm, setMovieForm] = useState({ title: '', rating: '' });
    const [hallForm, setHallForm] = useState({ hall_number: '', seat_codes: '' });
    const [editMovieForm, setEditMovieForm] = useState({ title: '', rating: '' });
    const [editHallForm, setEditHallForm] = useState({ hall_number: '', seat_codes: '' });
    const [editBookingForm, setEditBookingForm] = useState({
        customer_email: '',
        showtime_id: '',
        seat_id: '',
        ticket_type: '',
        payment_status: '',
    });
    const [editShowtimeForm, setEditShowtimeForm] = useState({ movie_id: '', cinema_hall_id: '', showtime_start: '' });
    const requestVersion = useRef(0);
    const previousSearch = useRef(search);

    const loadDashboard = useCallback(async (bookingsUrl = '/movie-bookings', showtimesUrl = '/showtimes') => {
        const currentRequest = ++requestVersion.current;
        setLoading(true);
        setError(null);

        try {
            const [bookings, showtimes, bookingDependencies, showtimeDependencies] = await Promise.all([
                requestJson<Paginated<MovieBooking>>(bookingsUrl),
                requestJson<Paginated<Showtime>>(showtimesUrl),
                requestJson<BookingDependencies>('/movie-bookings/create'),
                requestJson<ShowtimeDependencies>('/showtimes/create'),
            ]);

            if (currentRequest === requestVersion.current) {
                setData({ bookings, showtimes, bookingDependencies, showtimeDependencies });
            }
        } catch (reason) {
            if (currentRequest === requestVersion.current) {
                setError(reason instanceof Error ? reason.message : 'Unable to load cinema data.');
            }
        } finally {
            if (currentRequest === requestVersion.current) {
                setLoading(false);
            }
        }
    }, []);

    const refreshDashboard = useCallback(() => {
        const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';

        return loadDashboard(`/movie-bookings${query}`);
    }, [loadDashboard, search]);

    useEffect(() => {
        void loadDashboard();
    }, [loadDashboard]);

    useEffect(() => {
        if (previousSearch.current === search) return;
        previousSearch.current = search;

        const timer = window.setTimeout(() => {
            const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
            void loadDashboard(`/movie-bookings${query}`);
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search, loadDashboard]);

    const selectedShowtime = data?.bookingDependencies.showtimes.find((showtime) => String(showtime.id) === bookingForm.showtime_id);
    const selectedTicketPrice = bookingForm.ticket_type ? data?.bookingDependencies.ticket_types[bookingForm.ticket_type] : undefined;
    const reservedSeatIds = new Set(
        (selectedShowtime?.bookings ?? []).filter((booking) => booking.booking_id !== editBooking?.booking_id).map((booking) => booking.seat_id),
    );
    const availableSeats = selectedShowtime?.cinema_hall.seats?.filter((seat) => !reservedSeatIds.has(seat.id)) ?? [];
    const editingBookingShowtime = data?.bookingDependencies.showtimes.find((showtime) => String(showtime.id) === editBookingForm.showtime_id);
    const editReservedSeatIds = new Set(
        (editingBookingShowtime?.bookings ?? [])
            .filter((booking) => booking.booking_id !== editBooking?.booking_id)
            .map((booking) => booking.seat_id),
    );
    const editAvailableSeats = editingBookingShowtime?.cinema_hall.seats?.filter((seat) => !editReservedSeatIds.has(seat.id)) ?? [];

    async function submitBooking(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setFormError(null);

        try {
            await requestJson<MovieBooking>('/movie-bookings', {
                method: 'POST',
                body: JSON.stringify({
                    ...bookingForm,
                    showtime_id: Number(bookingForm.showtime_id),
                    seat_id: Number(bookingForm.seat_id),
                }),
            });
            setBookingDialogOpen(false);
            setBookingForm({ customer_email: '', showtime_id: '', seat_id: '', ticket_type: '' });
            await refreshDashboard();
        } catch (reason) {
            setFormError(reason instanceof Error ? reason.message : 'Unable to create the booking.');
        } finally {
            setSubmitting(false);
        }
    }

    async function submitShowtime(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setFormError(null);
        const shouldResumeBooking = resumeBookingAfterShowtime;

        try {
            await requestJson<Showtime>('/showtimes', {
                method: 'POST',
                body: JSON.stringify({
                    movie_id: Number(showtimeForm.movie_id),
                    cinema_hall_id: Number(showtimeForm.cinema_hall_id),
                    showtime_start: new Date(showtimeForm.showtime_start).toISOString(),
                }),
            });
            setShowtimeDialogOpen(false);
            setResumeBookingAfterShowtime(false);
            setShowtimeForm({ movie_id: '', cinema_hall_id: '', showtime_start: '' });
            await refreshDashboard();
            if (shouldResumeBooking) setBookingDialogOpen(true);
        } catch (reason) {
            setFormError(reason instanceof Error ? reason.message : 'Unable to create the showtime.');
        } finally {
            setSubmitting(false);
        }
    }

    async function submitMovie(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setFormError(null);
        const shouldResumeShowtime = resumeShowtimeAfterCatalog;

        try {
            await requestJson<Movie>('/movies', { method: 'POST', body: JSON.stringify(movieForm) });
            setMovieDialogOpen(false);
            setResumeShowtimeAfterCatalog(false);
            setMovieForm({ title: '', rating: '' });
            await refreshDashboard();
            if (shouldResumeShowtime) setShowtimeDialogOpen(true);
        } catch (reason) {
            setFormError(reason instanceof Error ? reason.message : 'Unable to add the movie.');
        } finally {
            setSubmitting(false);
        }
    }

    async function submitHall(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setFormError(null);
        const shouldResumeShowtime = resumeShowtimeAfterCatalog;

        try {
            await requestJson<CinemaHall>('/cinema-halls', {
                method: 'POST',
                body: JSON.stringify({
                    hall_number: hallForm.hall_number,
                    seat_codes: hallForm.seat_codes
                        .split(/[,\s]+/)
                        .map((seatCode) => seatCode.trim())
                        .filter(Boolean),
                }),
            });
            setHallDialogOpen(false);
            setResumeShowtimeAfterCatalog(false);
            setHallForm({ hall_number: '', seat_codes: '' });
            await refreshDashboard();
            if (shouldResumeShowtime) setShowtimeDialogOpen(true);
        } catch (reason) {
            setFormError(reason instanceof Error ? reason.message : 'Unable to add the cinema hall.');
        } finally {
            setSubmitting(false);
        }
    }

    async function saveBooking(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!editBooking) return;
        setSubmitting(true);
        setFormError(null);

        try {
            await requestJson<MovieBooking>(`/movie-bookings/${editBooking.booking_id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    ...editBookingForm,
                    showtime_id: Number(editBookingForm.showtime_id),
                    seat_id: Number(editBookingForm.seat_id),
                }),
            });
            setEditBooking(null);
            await refreshDashboard();
        } catch (reason) {
            setFormError(reason instanceof Error ? reason.message : 'Unable to update the booking.');
        } finally {
            setSubmitting(false);
        }
    }

    async function saveShowtime(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!editShowtime) return;
        setSubmitting(true);
        setFormError(null);

        try {
            await requestJson<Showtime>(`/showtimes/${editShowtime.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    movie_id: Number(editShowtimeForm.movie_id),
                    cinema_hall_id: Number(editShowtimeForm.cinema_hall_id),
                    showtime_start: new Date(editShowtimeForm.showtime_start).toISOString(),
                }),
            });
            setEditShowtime(null);
            await refreshDashboard();
        } catch (reason) {
            setFormError(reason instanceof Error ? reason.message : 'Unable to update the showtime.');
        } finally {
            setSubmitting(false);
        }
    }

    async function saveMovie(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!editMovie) return;
        setSubmitting(true);
        setFormError(null);

        try {
            await requestJson<Movie>(`/movies/${editMovie.id}`, {
                method: 'PUT',
                body: JSON.stringify(editMovieForm),
            });
            setEditMovie(null);
            await refreshDashboard();
        } catch (reason) {
            setFormError(reason instanceof Error ? reason.message : 'Unable to update the movie.');
        } finally {
            setSubmitting(false);
        }
    }

    async function saveHall(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!editHall) return;
        setSubmitting(true);
        setFormError(null);

        try {
            await requestJson<CinemaHall>(`/cinema-halls/${editHall.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    hall_number: editHallForm.hall_number,
                    seat_codes: editHallForm.seat_codes
                        .split(/[,\s]+/)
                        .map((seatCode) => seatCode.trim())
                        .filter(Boolean),
                }),
            });
            setEditHall(null);
            await refreshDashboard();
        } catch (reason) {
            setFormError(reason instanceof Error ? reason.message : 'Unable to update the cinema hall.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Cinema dashboard" />
            <div className="bg-muted/20 min-h-full">
                <main className="mx-auto flex w-full max-w-7xl flex-col gap-7 p-4 sm:p-6 lg:p-8">
                    <section className="flex flex-col justify-between gap-5 rounded-2xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:p-8">
                        <div>
                            <Badge className="mb-4 border-white/15 bg-white/10 text-white hover:bg-white/10" variant="outline">
                                <Clapperboard className="mr-1.5 size-3.5" />
                                CINEMA OPERATIONS
                            </Badge>
                            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your multiplex, at a glance.</h1>
                            <p className="mt-2 max-w-xl text-sm text-zinc-300 sm:text-base">Keep screenings moving and every seat accounted for.</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                                <Link href={route('logout')} method="post" as="button">
                                    <LogOut />
                                    Log out
                                </Link>
                            </Button>
                            <Button
                                className="bg-white text-zinc-950 hover:bg-zinc-200"
                                onClick={() => {
                                    setFormError(null);
                                    setShowtimeDialogOpen(true);
                                }}
                            >
                                <Plus />
                                Add showtime
                            </Button>
                            <Button
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={() => {
                                    setFormError(null);
                                    setBookingDialogOpen(true);
                                }}
                            >
                                <Ticket />
                                New booking
                            </Button>
                        </div>
                    </section>

                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Could not load the dashboard</AlertTitle>
                            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <span>{error}</span>
                                <Button size="sm" variant="outline" onClick={() => void loadDashboard()}>
                                    Try again
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard
                            label="Total bookings"
                            value={loading ? '—' : String(data?.bookings.total ?? 0)}
                            note="Across all screenings"
                            icon={Ticket}
                            onClick={() => document.getElementById('bookings')?.scrollIntoView({ behavior: 'smooth' })}
                        />
                        <MetricCard
                            label="Upcoming screenings"
                            value={loading ? '—' : String(data?.showtimes.total ?? 0)}
                            note="Movies on the calendar"
                            icon={CalendarDays}
                            onClick={() => document.getElementById('showtimes')?.scrollIntoView({ behavior: 'smooth' })}
                        />
                        <MetricCard
                            label="Cinema halls"
                            value={loading ? '—' : String(data?.showtimeDependencies.cinema_halls.length ?? 0)}
                            note="Available for scheduling"
                            icon={Film}
                            onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
                        />
                        <MetricCard
                            label="Booking value"
                            value={
                                loading
                                    ? '—'
                                    : formatCurrency(data?.bookings.data.reduce((total, booking) => total + Number(booking.total_amount), 0) ?? 0)
                            }
                            note="Bookings on this page"
                            icon={Wallet}
                            onClick={() => document.getElementById('bookings')?.scrollIntoView({ behavior: 'smooth' })}
                        />
                    </section>

                    <section id="showtimes" className="grid scroll-mt-6 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                        <Card className="border-border/70 shadow-none">
                            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                                <div>
                                    <CardTitle className="text-lg">Coming up</CardTitle>
                                    <CardDescription className="mt-1">Select a screening to edit its movie, hall, or time.</CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setFormError(null);
                                        setShowtimeDialogOpen(true);
                                    }}
                                >
                                    <Plus />
                                    Showtime
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {loading && !data ? (
                                    <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
                                        <LoaderCircle className="size-4 animate-spin" />
                                        Loading screenings…
                                    </div>
                                ) : data?.showtimes.data.length ? (
                                    <div className="divide-y">
                                        {data.showtimes.data.map((showtime) => (
                                            <div
                                                key={showtime.id}
                                                role="button"
                                                tabIndex={0}
                                                className="hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-ring flex w-full items-center gap-4 rounded-lg px-2 py-4 text-left transition-colors outline-none first:pt-1 last:pb-1 focus-visible:ring-2"
                                                onClick={() => {
                                                    setFormError(null);
                                                    setEditShowtime(showtime);
                                                    setEditShowtimeForm({
                                                        movie_id: String(showtime.movie.id),
                                                        cinema_hall_id: String(showtime.cinema_hall.id),
                                                        showtime_start: formatDateTimeLocal(showtime.showtime_start),
                                                    });
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        setFormError(null);
                                                        setEditShowtime(showtime);
                                                        setEditShowtimeForm({
                                                            movie_id: String(showtime.movie.id),
                                                            cinema_hall_id: String(showtime.cinema_hall.id),
                                                            showtime_start: formatDateTimeLocal(showtime.showtime_start),
                                                        });
                                                    }
                                                }}
                                                aria-label={`Edit ${showtime.movie.title} in hall ${showtime.cinema_hall.hall_number}`}
                                            >
                                                <div className="bg-primary/10 text-primary flex size-12 shrink-0 flex-col items-center justify-center rounded-xl">
                                                    <span className="text-[10px] leading-none font-semibold uppercase">
                                                        {formatDate(showtime.showtime_start, { month: 'short' })}
                                                    </span>
                                                    <span className="mt-1 text-lg leading-none font-bold">
                                                        {formatDate(showtime.showtime_start, { day: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-medium">{showtime.movie.title}</p>
                                                    <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                                                        <Clapperboard className="size-3.5" />
                                                        Hall {showtime.cinema_hall.hall_number}
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className="shrink-0 gap-1.5 font-medium">
                                                    <Clock3 className="size-3.5" />
                                                    {formatDate(showtime.showtime_start, { hour: 'numeric', minute: '2-digit' })}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
                                        <CalendarDays className="text-muted-foreground mb-3 size-8" />
                                        <p className="font-medium">No screenings scheduled</p>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            Add a movie and hall first, then schedule your first showtime.
                                        </p>
                                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                                            {!data?.showtimeDependencies.movies.length && (
                                                <Button size="sm" variant="outline" onClick={() => setMovieDialogOpen(true)}>
                                                    <Plus />
                                                    Add movie
                                                </Button>
                                            )}
                                            {!data?.showtimeDependencies.cinema_halls.length && (
                                                <Button size="sm" variant="outline" onClick={() => setHallDialogOpen(true)}>
                                                    <Plus />
                                                    Add hall & seats
                                                </Button>
                                            )}
                                            {Boolean(data?.showtimeDependencies.movies.length && data?.showtimeDependencies.cinema_halls.length) && (
                                                <Button size="sm" onClick={() => setShowtimeDialogOpen(true)}>
                                                    <Plus />
                                                    Schedule a showtime
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {data && data.showtimes.last_page > 1 && (
                                    <div className="text-muted-foreground mt-4 flex items-center justify-between border-t pt-4 text-sm">
                                        <span>
                                            Page {data.showtimes.current_page} of {data.showtimes.last_page} · {data.showtimes.total} showtimes
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={!data.showtimes.prev_page_url || loading}
                                                onClick={() =>
                                                    data.showtimes.prev_page_url &&
                                                    void loadDashboard(
                                                        data.bookings.current_page > 1
                                                            ? `/movie-bookings?page=${data.bookings.current_page}`
                                                            : '/movie-bookings',
                                                        data.showtimes.prev_page_url,
                                                    )
                                                }
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={!data.showtimes.next_page_url || loading}
                                                onClick={() =>
                                                    data.showtimes.next_page_url &&
                                                    void loadDashboard(
                                                        data.bookings.current_page > 1
                                                            ? `/movie-bookings?page=${data.bookings.current_page}`
                                                            : '/movie-bookings',
                                                        data.showtimes.next_page_url,
                                                    )
                                                }
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-border/70 shadow-none">
                            <CardHeader>
                                <CardTitle className="text-lg">Quick booking</CardTitle>
                                <CardDescription>Reserve a seat for a customer in just a few steps.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex h-[calc(100%-5rem)] flex-col items-start justify-between gap-6">
                                <div className="bg-muted/60 w-full rounded-xl p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-background text-primary rounded-lg p-2.5 shadow-sm">
                                            <Users className="size-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium">Ready for your next guest?</p>
                                            <p className="text-muted-foreground text-sm">Choose a show, seat, and ticket type.</p>
                                        </div>
                                    </div>
                                    <div className="mt-5 grid grid-cols-2 gap-3">
                                        <div className="bg-background rounded-lg p-3">
                                            <p className="text-2xl font-semibold">{data?.bookingDependencies.showtimes.length ?? 0}</p>
                                            <p className="text-muted-foreground text-xs">Shows to book</p>
                                        </div>
                                        <div className="bg-background rounded-lg p-3">
                                            <p className="text-2xl font-semibold">
                                                {Object.keys(data?.bookingDependencies.ticket_types ?? {}).length}
                                            </p>
                                            <p className="text-muted-foreground text-xs">Ticket options</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid w-full gap-2 sm:grid-cols-2">
                                    <Button className="w-full" onClick={() => setBookingDialogOpen(true)}>
                                        <Ticket />
                                        Create a booking
                                    </Button>
                                    <Button variant="outline" onClick={() => setMovieDialogOpen(true)}>
                                        <Plus />
                                        Add movie
                                    </Button>
                                    <Button variant="outline" onClick={() => setHallDialogOpen(true)}>
                                        <Plus />
                                        Add hall & seats
                                    </Button>
                                    <Button variant="outline" onClick={() => setShowtimeDialogOpen(true)}>
                                        <Plus />
                                        Add showtime
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section id="catalog" className="grid scroll-mt-6 gap-6 xl:grid-cols-2">
                        <Card className="border-border/70 shadow-none">
                            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                                <div>
                                    <CardTitle className="text-lg">Movie catalog</CardTitle>
                                    <CardDescription className="mt-1">Select a movie to edit its details.</CardDescription>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => setMovieDialogOpen(true)}>
                                    <Plus />
                                    Add movie
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {data?.showtimeDependencies.movies.length ? (
                                    <div className="divide-y">
                                        {data.showtimeDependencies.movies.map((movie) => (
                                            <button
                                                key={movie.id}
                                                type="button"
                                                className="hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-ring flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left outline-none focus-visible:ring-2"
                                                onClick={() => {
                                                    setFormError(null);
                                                    setEditMovie(movie);
                                                    setEditMovieForm({ title: movie.title, rating: movie.rating });
                                                }}
                                            >
                                                <span className="flex min-w-0 items-center gap-3">
                                                    <Film className="text-muted-foreground size-4 shrink-0" />
                                                    <span className="truncate font-medium">{movie.title}</span>
                                                </span>
                                                <Badge variant="outline">{movie.rating}</Badge>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground py-6 text-center text-sm">No movies yet. Add one to schedule a showtime.</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-border/70 shadow-none">
                            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                                <div>
                                    <CardTitle className="text-lg">Cinema halls & seats</CardTitle>
                                    <CardDescription className="mt-1">Select a hall to edit its number or seat layout.</CardDescription>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => setHallDialogOpen(true)}>
                                    <Plus />
                                    Add hall
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {data?.showtimeDependencies.cinema_halls.length ? (
                                    <div className="divide-y">
                                        {data.showtimeDependencies.cinema_halls.map((hall) => (
                                            <button
                                                key={hall.id}
                                                type="button"
                                                className="hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-ring flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left outline-none focus-visible:ring-2"
                                                onClick={() => {
                                                    setFormError(null);
                                                    setEditHall(hall);
                                                    setEditHallForm({
                                                        hall_number: hall.hall_number,
                                                        seat_codes: (hall.seats ?? []).map((seat) => seat.seat_code).join(', '),
                                                    });
                                                }}
                                            >
                                                <span className="flex min-w-0 items-center gap-3">
                                                    <Clapperboard className="text-muted-foreground size-4 shrink-0" />
                                                    <span className="font-medium">Hall {hall.hall_number}</span>
                                                </span>
                                                <Badge variant="outline">{hall.seats?.length ?? 0} seats</Badge>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground py-6 text-center text-sm">No halls yet. Add a hall and its seats.</p>
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    <section id="bookings">
                        <Card className="border-border/70 shadow-none">
                            <CardHeader className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                                <div>
                                    <CardTitle className="text-lg">Recent bookings</CardTitle>
                                    <CardDescription className="mt-1">
                                        Select a booking to edit its customer, seat, ticket, or payment status.
                                    </CardDescription>
                                </div>
                                <div className="relative w-full sm:max-w-xs">
                                    <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                                    <Input
                                        aria-label="Search bookings"
                                        type="search"
                                        className="pl-9"
                                        placeholder="Search customer, movie, seat…"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[700px] text-left text-sm">
                                        <thead>
                                            <tr className="text-muted-foreground border-b text-xs font-medium tracking-wide uppercase">
                                                <th className="px-3 py-3">Customer</th>
                                                <th className="px-3 py-3">Movie & screening</th>
                                                <th className="px-3 py-3">Seat</th>
                                                <th className="px-3 py-3">Ticket</th>
                                                <th className="px-3 py-3">Amount</th>
                                                <th className="px-3 py-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {loading && !data ? (
                                                <tr>
                                                    <td colSpan={6} className="text-muted-foreground py-12 text-center">
                                                        <LoaderCircle className="mr-2 inline size-4 animate-spin" />
                                                        Loading bookings…
                                                    </td>
                                                </tr>
                                            ) : data?.bookings.data.length ? (
                                                data.bookings.data.map((booking) => (
                                                    <tr
                                                        key={booking.booking_id}
                                                        className="hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-ring cursor-pointer transition-colors outline-none focus-visible:ring-2"
                                                        tabIndex={0}
                                                        role="button"
                                                        aria-label={`Edit booking for ${booking.customer_email}`}
                                                        onClick={() => {
                                                            setFormError(null);
                                                            setEditBooking(booking);
                                                            setEditBookingForm({
                                                                customer_email: booking.customer_email,
                                                                showtime_id: String(booking.showtime.id),
                                                                seat_id: String(booking.seat.id),
                                                                ticket_type: booking.ticket_type,
                                                                payment_status: booking.payment_status,
                                                            });
                                                        }}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter' || event.key === ' ') {
                                                                event.preventDefault();
                                                                setFormError(null);
                                                                setEditBooking(booking);
                                                                setEditBookingForm({
                                                                    customer_email: booking.customer_email,
                                                                    showtime_id: String(booking.showtime.id),
                                                                    seat_id: String(booking.seat.id),
                                                                    ticket_type: booking.ticket_type,
                                                                    payment_status: booking.payment_status,
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        <td className="px-3 py-4">
                                                            <p className="font-medium">{booking.customer_email}</p>
                                                            <p className="text-muted-foreground mt-1 text-xs">
                                                                {formatDate(booking.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </p>
                                                        </td>
                                                        <td className="px-3 py-4">
                                                            <p className="font-medium">{booking.showtime.movie.title}</p>
                                                            <p className="text-muted-foreground mt-1 text-xs">
                                                                {formatDate(booking.showtime.showtime_start, {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    hour: 'numeric',
                                                                    minute: '2-digit',
                                                                })}
                                                            </p>
                                                        </td>
                                                        <td className="px-3 py-4">
                                                            <Badge variant="outline">
                                                                Hall {booking.showtime.cinema_hall.hall_number} · {booking.seat.seat_code}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-4 capitalize">{booking.ticket_type}</td>
                                                        <td className="px-3 py-4 font-medium">{formatCurrency(booking.total_amount)}</td>
                                                        <td className="px-3 py-4">
                                                            <Badge variant={statusVariant(booking.payment_status)} className="capitalize">
                                                                {booking.payment_status}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} className="py-12 text-center">
                                                        <Ticket className="text-muted-foreground mx-auto mb-3 size-8" />
                                                        <p className="font-medium">{search ? 'No matching bookings' : 'No bookings yet'}</p>
                                                        <p className="text-muted-foreground mt-1 text-sm">
                                                            {search ? 'Try another search term.' : 'New customer reservations will appear here.'}
                                                        </p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {data && data.bookings.last_page > 1 && (
                                    <div className="text-muted-foreground mt-4 flex items-center justify-between border-t pt-4 text-sm">
                                        <span>
                                            Page {data.bookings.current_page} of {data.bookings.last_page} · {data.bookings.total} bookings
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={!data.bookings.prev_page_url || loading}
                                                onClick={() => data.bookings.prev_page_url && void loadDashboard(data.bookings.prev_page_url)}
                                            >
                                                Previous
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={!data.bookings.next_page_url || loading}
                                                onClick={() => data.bookings.next_page_url && void loadDashboard(data.bookings.next_page_url)}
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </section>
                </main>
            </div>

            <Dialog
                open={bookingDialogOpen}
                onOpenChange={(open) => {
                    setBookingDialogOpen(open);
                    if (open) setFormError(null);
                }}
            >
                <DialogContent>
                    <form onSubmit={submitBooking}>
                        <DialogHeader>
                            <DialogTitle>New movie booking</DialogTitle>
                            <DialogDescription>Reserve a seat and calculate the ticket price automatically.</DialogDescription>
                        </DialogHeader>
                        {!data?.bookingDependencies.showtimes.length && (
                            <div className="bg-muted/60 mt-4 grid gap-3 rounded-lg p-4">
                                <p className="text-sm">You need a scheduled showtime before you can book a seat.</p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setResumeBookingAfterShowtime(true);
                                        setBookingDialogOpen(false);
                                        setShowtimeDialogOpen(true);
                                    }}
                                >
                                    <Plus />
                                    Schedule a showtime
                                </Button>
                            </div>
                        )}
                        <div className="grid gap-4 py-5">
                            <div className="grid gap-2">
                                <Label htmlFor="booking-email">Customer email</Label>
                                <Input
                                    id="booking-email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={bookingForm.customer_email}
                                    onChange={(event) => setBookingForm({ ...bookingForm, customer_email: event.target.value })}
                                    placeholder="guest@example.com"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="booking-showtime">Showtime</Label>
                                <Select
                                    value={bookingForm.showtime_id}
                                    onValueChange={(showtime_id) => setBookingForm({ ...bookingForm, showtime_id, seat_id: '' })}
                                >
                                    <SelectTrigger id="booking-showtime">
                                        <SelectValue placeholder="Choose a screening" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {data?.bookingDependencies.showtimes.map((showtime) => (
                                            <SelectItem key={showtime.id} value={String(showtime.id)}>
                                                {showtime.movie.title} · Hall {showtime.cinema_hall.hall_number} ·{' '}
                                                {formatDate(showtime.showtime_start, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                })}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="booking-seat">Seat</Label>
                                    <Select
                                        value={bookingForm.seat_id}
                                        onValueChange={(seat_id) => setBookingForm({ ...bookingForm, seat_id })}
                                        disabled={!selectedShowtime}
                                    >
                                        <SelectTrigger id="booking-seat">
                                            <SelectValue placeholder={selectedShowtime ? 'Choose a seat' : 'Choose a showtime first'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableSeats.map((seat) => (
                                                <SelectItem key={seat.id} value={String(seat.id)}>
                                                    {seat.seat_code}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedShowtime && availableSeats.length === 0 && (
                                        <p className="text-destructive text-sm">No seats are available for this screening.</p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="booking-ticket-type">Ticket type</Label>
                                    <Select
                                        value={bookingForm.ticket_type}
                                        onValueChange={(ticket_type) => setBookingForm({ ...bookingForm, ticket_type })}
                                    >
                                        <SelectTrigger id="booking-ticket-type">
                                            <SelectValue placeholder="Choose ticket" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(data?.bookingDependencies.ticket_types ?? {}).map(([type, price]) => (
                                                <SelectItem key={type} value={type}>
                                                    <span className="capitalize">{type}</span> · {formatCurrency(price)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {selectedTicketPrice !== undefined && (
                                <div className="bg-muted/60 flex items-center justify-between rounded-lg px-4 py-3 text-sm">
                                    <span className="text-muted-foreground">Booking total</span>
                                    <span className="font-semibold">{formatCurrency(selectedTicketPrice)}</span>
                                </div>
                            )}
                            {formError && (
                                <p role="alert" className="text-destructive text-sm">
                                    {formError}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setBookingDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={submitting || !selectedShowtime || !bookingForm.seat_id || !bookingForm.ticket_type}>
                                {submitting && <LoaderCircle className="animate-spin" />}
                                Confirm booking
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={showtimeDialogOpen}
                onOpenChange={(open) => {
                    setShowtimeDialogOpen(open);
                    if (open) setFormError(null);
                    else setResumeBookingAfterShowtime(false);
                }}
            >
                <DialogContent>
                    <form onSubmit={submitShowtime}>
                        <DialogHeader>
                            <DialogTitle>Schedule a showtime</DialogTitle>
                            <DialogDescription>Select a movie, hall, and screening time.</DialogDescription>
                        </DialogHeader>
                        {(!data?.showtimeDependencies.movies.length || !data?.showtimeDependencies.cinema_halls.length) && (
                            <div className="bg-muted/60 mt-4 grid gap-3 rounded-lg p-4">
                                <p className="text-sm">
                                    Add {!data?.showtimeDependencies.movies.length ? 'a movie' : ''}
                                    {!data?.showtimeDependencies.movies.length && !data?.showtimeDependencies.cinema_halls.length ? ' and ' : ''}
                                    {!data?.showtimeDependencies.cinema_halls.length ? 'a cinema hall with seats' : ''} before scheduling.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {!data?.showtimeDependencies.movies.length && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setResumeShowtimeAfterCatalog(true);
                                                setShowtimeDialogOpen(false);
                                                setMovieDialogOpen(true);
                                            }}
                                        >
                                            <Plus />
                                            Add movie
                                        </Button>
                                    )}
                                    {!data?.showtimeDependencies.cinema_halls.length && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setResumeShowtimeAfterCatalog(true);
                                                setShowtimeDialogOpen(false);
                                                setHallDialogOpen(true);
                                            }}
                                        >
                                            <Plus />
                                            Add hall & seats
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="grid gap-4 py-5">
                            <div className="grid gap-2">
                                <Label htmlFor="showtime-movie">Movie</Label>
                                <Select value={showtimeForm.movie_id} onValueChange={(movie_id) => setShowtimeForm({ ...showtimeForm, movie_id })}>
                                    <SelectTrigger id="showtime-movie">
                                        <SelectValue placeholder="Choose a movie" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {data?.showtimeDependencies.movies.map((movie) => (
                                            <SelectItem key={movie.id} value={String(movie.id)}>
                                                {movie.title} · {movie.rating}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="showtime-hall">Cinema hall</Label>
                                <Select
                                    value={showtimeForm.cinema_hall_id}
                                    onValueChange={(cinema_hall_id) => setShowtimeForm({ ...showtimeForm, cinema_hall_id })}
                                >
                                    <SelectTrigger id="showtime-hall">
                                        <SelectValue placeholder="Choose a hall" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {data?.showtimeDependencies.cinema_halls.map((hall) => (
                                            <SelectItem key={hall.id} value={String(hall.id)}>
                                                Hall {hall.hall_number}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="showtime-start">Date and time</Label>
                                <Input
                                    id="showtime-start"
                                    type="datetime-local"
                                    required
                                    value={showtimeForm.showtime_start}
                                    onChange={(event) => setShowtimeForm({ ...showtimeForm, showtime_start: event.target.value })}
                                />
                            </div>
                            {formError && (
                                <p role="alert" className="text-destructive text-sm">
                                    {formError}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowtimeDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={submitting || !showtimeForm.movie_id || !showtimeForm.cinema_hall_id || !showtimeForm.showtime_start}
                            >
                                {submitting && <LoaderCircle className="animate-spin" />}
                                Save showtime
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={movieDialogOpen}
                onOpenChange={(open) => {
                    setMovieDialogOpen(open);
                    if (open) setFormError(null);
                    else setResumeShowtimeAfterCatalog(false);
                }}
            >
                <DialogContent>
                    <form onSubmit={submitMovie}>
                        <DialogHeader>
                            <DialogTitle>Add a movie</DialogTitle>
                            <DialogDescription>Add a movie to the schedule catalog.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-5">
                            <div className="grid gap-2">
                                <Label htmlFor="movie-title">Movie title</Label>
                                <Input
                                    id="movie-title"
                                    required
                                    maxLength={255}
                                    value={movieForm.title}
                                    onChange={(event) => setMovieForm({ ...movieForm, title: event.target.value })}
                                    placeholder="e.g. The Grand Adventure"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="movie-rating">Rating</Label>
                                <Input
                                    id="movie-rating"
                                    required
                                    maxLength={10}
                                    value={movieForm.rating}
                                    onChange={(event) => setMovieForm({ ...movieForm, rating: event.target.value })}
                                    placeholder="e.g. PG-13"
                                />
                            </div>
                            {formError && (
                                <p role="alert" className="text-destructive text-sm">
                                    {formError}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setMovieDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={submitting || !movieForm.title.trim() || !movieForm.rating.trim()}>
                                {submitting && <LoaderCircle className="animate-spin" />}
                                Save movie
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={hallDialogOpen}
                onOpenChange={(open) => {
                    setHallDialogOpen(open);
                    if (open) setFormError(null);
                    else setResumeShowtimeAfterCatalog(false);
                }}
            >
                <DialogContent>
                    <form onSubmit={submitHall}>
                        <DialogHeader>
                            <DialogTitle>Add a cinema hall</DialogTitle>
                            <DialogDescription>Create the hall and its seats. Separate seat codes with commas or spaces.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-5">
                            <div className="grid gap-2">
                                <Label htmlFor="hall-number">Hall number</Label>
                                <Input
                                    id="hall-number"
                                    required
                                    maxLength={20}
                                    value={hallForm.hall_number}
                                    onChange={(event) => setHallForm({ ...hallForm, hall_number: event.target.value })}
                                    placeholder="e.g. Hall 1"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="seat-codes">Seat codes</Label>
                                <Input
                                    id="seat-codes"
                                    required
                                    value={hallForm.seat_codes}
                                    onChange={(event) => setHallForm({ ...hallForm, seat_codes: event.target.value })}
                                    placeholder="A1, A2, A3, B1, B2"
                                />
                            </div>
                            {formError && (
                                <p role="alert" className="text-destructive text-sm">
                                    {formError}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setHallDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={submitting || !hallForm.hall_number.trim() || !hallForm.seat_codes.trim()}>
                                {submitting && <LoaderCircle className="animate-spin" />}
                                Save hall and seats
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(editMovie)} onOpenChange={(open) => !open && setEditMovie(null)}>
                <DialogContent>
                    <form onSubmit={saveMovie}>
                        <DialogHeader>
                            <DialogTitle>Edit movie</DialogTitle>
                            <DialogDescription>Changes will appear in the movie catalog and associated showtimes.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-5">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-movie-title">Movie title</Label>
                                <Input
                                    id="edit-movie-title"
                                    required
                                    maxLength={255}
                                    value={editMovieForm.title}
                                    onChange={(event) => setEditMovieForm({ ...editMovieForm, title: event.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-movie-rating">Rating</Label>
                                <Input
                                    id="edit-movie-rating"
                                    required
                                    maxLength={10}
                                    value={editMovieForm.rating}
                                    onChange={(event) => setEditMovieForm({ ...editMovieForm, rating: event.target.value })}
                                />
                            </div>
                            {formError && (
                                <p role="alert" className="text-destructive text-sm">
                                    {formError}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditMovie(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={submitting || !editMovieForm.title.trim() || !editMovieForm.rating.trim()}>
                                {submitting && <LoaderCircle className="animate-spin" />}
                                Save changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(editHall)} onOpenChange={(open) => !open && setEditHall(null)}>
                <DialogContent>
                    <form onSubmit={saveHall}>
                        <DialogHeader>
                            <DialogTitle>Edit cinema hall</DialogTitle>
                            <DialogDescription>Booked seats cannot be removed. Separate seat codes with commas or spaces.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-5">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-hall-number">Hall number</Label>
                                <Input
                                    id="edit-hall-number"
                                    required
                                    maxLength={20}
                                    value={editHallForm.hall_number}
                                    onChange={(event) => setEditHallForm({ ...editHallForm, hall_number: event.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-seat-codes">Seat codes</Label>
                                <Input
                                    id="edit-seat-codes"
                                    required
                                    value={editHallForm.seat_codes}
                                    onChange={(event) => setEditHallForm({ ...editHallForm, seat_codes: event.target.value })}
                                />
                            </div>
                            {formError && (
                                <p role="alert" className="text-destructive text-sm">
                                    {formError}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditHall(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={submitting || !editHallForm.hall_number.trim() || !editHallForm.seat_codes.trim()}>
                                {submitting && <LoaderCircle className="animate-spin" />}
                                Save hall and seats
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(editShowtime)} onOpenChange={(open) => !open && setEditShowtime(null)}>
                <DialogContent>
                    <form onSubmit={saveShowtime}>
                        <DialogHeader>
                            <DialogTitle>Edit showtime</DialogTitle>
                            <DialogDescription>
                                {editShowtime ? `${editShowtime.movie.title} · Hall ${editShowtime.cinema_hall.hall_number}` : ''}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-5">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-showtime-movie">Movie</Label>
                                <Select
                                    value={editShowtimeForm.movie_id}
                                    onValueChange={(movie_id) => setEditShowtimeForm({ ...editShowtimeForm, movie_id })}
                                >
                                    <SelectTrigger id="edit-showtime-movie">
                                        <SelectValue placeholder="Choose a movie" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {data?.showtimeDependencies.movies.map((movie) => (
                                            <SelectItem key={movie.id} value={String(movie.id)}>
                                                {movie.title} · {movie.rating}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-showtime-hall">Cinema hall</Label>
                                <Select
                                    value={editShowtimeForm.cinema_hall_id}
                                    onValueChange={(cinema_hall_id) => setEditShowtimeForm({ ...editShowtimeForm, cinema_hall_id })}
                                >
                                    <SelectTrigger id="edit-showtime-hall">
                                        <SelectValue placeholder="Choose a hall" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {data?.showtimeDependencies.cinema_halls.map((hall) => (
                                            <SelectItem key={hall.id} value={String(hall.id)}>
                                                Hall {hall.hall_number}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-showtime-start">Date and time</Label>
                                <Input
                                    id="edit-showtime-start"
                                    type="datetime-local"
                                    required
                                    value={editShowtimeForm.showtime_start}
                                    onChange={(event) => setEditShowtimeForm({ ...editShowtimeForm, showtime_start: event.target.value })}
                                />
                            </div>
                            {formError && (
                                <p role="alert" className="text-destructive text-sm">
                                    {formError}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditShowtime(null)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    submitting || !editShowtimeForm.movie_id || !editShowtimeForm.cinema_hall_id || !editShowtimeForm.showtime_start
                                }
                            >
                                {submitting && <LoaderCircle className="animate-spin" />}
                                Save changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(editBooking)} onOpenChange={(open) => !open && setEditBooking(null)}>
                <DialogContent>
                    <form onSubmit={saveBooking}>
                        <DialogHeader>
                            <DialogTitle>Update booking</DialogTitle>
                            <DialogDescription>
                                {editBooking
                                    ? `${editBooking.customer_email} · ${editBooking.showtime.movie.title} · ${editBooking.seat.seat_code}`
                                    : ''}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-5">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-booking-email">Customer email</Label>
                                <Input
                                    id="edit-booking-email"
                                    type="email"
                                    required
                                    value={editBookingForm.customer_email}
                                    onChange={(event) => setEditBookingForm({ ...editBookingForm, customer_email: event.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-booking-showtime">Showtime</Label>
                                <Select
                                    value={editBookingForm.showtime_id}
                                    onValueChange={(showtime_id) => setEditBookingForm({ ...editBookingForm, showtime_id, seat_id: '' })}
                                >
                                    <SelectTrigger id="edit-booking-showtime">
                                        <SelectValue placeholder="Choose a screening" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {data?.bookingDependencies.showtimes.map((showtime) => (
                                            <SelectItem key={showtime.id} value={String(showtime.id)}>
                                                {showtime.movie.title} · Hall {showtime.cinema_hall.hall_number} ·{' '}
                                                {formatDate(showtime.showtime_start, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                })}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-booking-seat">Seat</Label>
                                    <Select
                                        value={editBookingForm.seat_id}
                                        onValueChange={(seat_id) => setEditBookingForm({ ...editBookingForm, seat_id })}
                                        disabled={!editingBookingShowtime}
                                    >
                                        <SelectTrigger id="edit-booking-seat">
                                            <SelectValue placeholder="Choose a seat" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {editAvailableSeats.map((seat) => (
                                                <SelectItem key={seat.id} value={String(seat.id)}>
                                                    {seat.seat_code}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-booking-ticket-type">Ticket type</Label>
                                    <Select
                                        value={editBookingForm.ticket_type}
                                        onValueChange={(ticket_type) => setEditBookingForm({ ...editBookingForm, ticket_type })}
                                    >
                                        <SelectTrigger id="edit-booking-ticket-type">
                                            <SelectValue placeholder="Choose ticket" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(data?.bookingDependencies.ticket_types ?? {}).map(([type, price]) => (
                                                <SelectItem key={type} value={type}>
                                                    <span className="capitalize">{type}</span> · {formatCurrency(price)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="booking-status">Payment status</Label>
                                <Select
                                    value={editBookingForm.payment_status}
                                    onValueChange={(payment_status) => setEditBookingForm({ ...editBookingForm, payment_status })}
                                >
                                    <SelectTrigger id="booking-status">
                                        <SelectValue placeholder="Choose a status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(data?.bookingDependencies.payment_statuses ?? []).map((status) => (
                                            <SelectItem key={status} value={status}>
                                                <span className="capitalize">{status}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {editBookingForm.ticket_type && (
                                <div className="bg-muted/60 flex items-center justify-between rounded-lg px-4 py-3 text-sm">
                                    <span className="text-muted-foreground">Updated total</span>
                                    <span className="font-semibold">
                                        {formatCurrency(data?.bookingDependencies.ticket_types[editBookingForm.ticket_type] ?? 0)}
                                    </span>
                                </div>
                            )}
                            {formError && (
                                <p role="alert" className="text-destructive text-sm">
                                    {formError}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditBooking(null)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    submitting ||
                                    !editBookingForm.customer_email ||
                                    !editingBookingShowtime ||
                                    !editBookingForm.seat_id ||
                                    !editBookingForm.ticket_type ||
                                    !editBookingForm.payment_status
                                }
                            >
                                {submitting && <LoaderCircle className="animate-spin" />}
                                Save changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
