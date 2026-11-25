import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { formatCurrency, requestJson } from '@/lib/cinema-api';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Armchair, CalendarDays, CheckCircle2, CreditCard, LoaderCircle, Ticket, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';

type PaymentMethod = 'card' | 'ewallet' | 'cash';
type DraftIssue = 'missing' | 'invalid' | 'unreadable';

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

type Booking = {
    booking_id: number;
    total_amount: string;
    payment_status: string;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Payment', href: '/payment' }];

const paymentMethods: { value: PaymentMethod; label: string; detail: string; icon: typeof CreditCard }[] = [
    { value: 'card', label: 'Credit or debit card', detail: 'Card payment preference', icon: CreditCard },
    { value: 'ewallet', label: 'E-wallet', detail: 'Digital wallet preference', icon: Wallet },
    { value: 'cash', label: 'Pay at the counter', detail: 'Settle when you arrive', icon: Armchair },
];

const draftIssueCopy: Record<DraftIssue, { title: string; message: string }> = {
    missing: {
        title: 'No booking to pay for',
        message: 'Choose a movie and seat first, then return here to review your booking and payment method.',
    },
    invalid: {
        title: 'Booking details unavailable',
        message: 'The saved booking details are invalid. Start a new booking to continue.',
    },
    unreadable: {
        title: 'Booking details unavailable',
        message: 'The saved booking details could not be read. Start a new booking to continue.',
    },
};

function isCheckoutDraft(value: unknown): value is CheckoutDraft {
    if (!value || typeof value !== 'object') return false;
    const draft = value as Partial<CheckoutDraft>;

    return (
        typeof draft.customerEmail === 'string' &&
        Number.isInteger(draft.showtimeId) &&
        Number.isInteger(draft.seatId) &&
        typeof draft.ticketType === 'string' &&
        typeof draft.ticketPrice === 'number' &&
        typeof draft.serviceFee === 'number' &&
        typeof draft.movieTitle === 'string' &&
        typeof draft.movieRating === 'string' &&
        typeof draft.showtimeStart === 'string' &&
        typeof draft.hallNumber === 'string' &&
        typeof draft.seatCode === 'string'
    );
}

function formatShowtime(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

export default function Payment() {
    const [draft, setDraft] = useState<CheckoutDraft | null>(null);
    const [draftError, setDraftError] = useState<DraftIssue | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [booking, setBooking] = useState<Booking | null>(null);

    useEffect(() => {
        const rawDraft = sessionStorage.getItem('cinema-checkout');
        if (!rawDraft) {
            setDraftError('missing');
            return;
        }

        try {
            const parsed: unknown = JSON.parse(rawDraft);
            if (!isCheckoutDraft(parsed)) {
                setDraftError('invalid');
                return;
            }

            setDraft(parsed);
        } catch {
            setDraftError('unreadable');
        }
    }, []);

    async function confirmBooking() {
        if (!draft) return;
        setSubmitting(true);
        setError(null);

        try {
            const result = await requestJson<Booking>('/movie-bookings', {
                method: 'POST',
                body: JSON.stringify({
                    customer_email: draft.customerEmail,
                    showtime_id: draft.showtimeId,
                    seat_id: draft.seatId,
                    ticket_type: draft.ticketType,
                    payment_method: paymentMethod,
                }),
            });
            sessionStorage.removeItem('cinema-checkout');
            setBooking(result);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to reserve this seat.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Payment and booking confirmation" />
            <main className="bg-muted/20 min-h-full">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
                    <header>
                        <p className="text-muted-foreground text-sm font-medium">Booking checkout</p>
                        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Payment</h1>
                        <p className="text-muted-foreground mt-2">Review your booking details and choose how you plan to pay.</p>
                    </header>

                    {booking ? (
                        <Card>
                            <CardContent className="flex flex-col items-center py-14 text-center">
                                <div className="bg-primary/10 text-primary rounded-full p-4">
                                    <CheckCircle2 className="size-9" />
                                </div>
                                <h2 className="mt-5 text-2xl font-semibold">Seat reserved</h2>
                                <p className="text-muted-foreground mt-2 max-w-lg">
                                    Booking #{booking.booking_id} is saved. Its payment status is {booking.payment_status}; online payments are not
                                    processed by this system yet.
                                </p>
                                <Badge variant="secondary" className="mt-4 capitalize">
                                    {booking.payment_status}
                                </Badge>
                                <Button asChild className="mt-6">
                                    <Link href="/dashboard">Return to dashboard</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ) : draftError ? (
                        <Card>
                            <CardContent className="flex flex-col items-center py-14 text-center">
                                <div className="bg-primary/10 text-primary rounded-full p-4">
                                    <Ticket className="size-8" />
                                </div>
                                <h2 className="mt-5 text-xl font-semibold">{draftIssueCopy[draftError].title}</h2>
                                <p className="text-muted-foreground mt-2 max-w-md text-sm">{draftIssueCopy[draftError].message}</p>
                                <Button className="mt-6" asChild>
                                    <Link href="/booking">Start a booking</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ) : draft ? (
                        <>
                            <Alert>
                                <AlertTitle>Payment processing is not configured</AlertTitle>
                                <AlertDescription>
                                    Confirming reserves the seat and records your preferred payment method. No card or e-wallet charge will be made;
                                    the booking remains pending.
                                </AlertDescription>
                            </Alert>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertTitle>Could not complete the booking</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                <Card className="lg:sticky lg:top-6">
                                    <CardHeader>
                                        <CardTitle>Booking summary</CardTitle>
                                        <CardDescription>Review before reserving your seat.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex flex-col gap-5">
                                        <div className="flex items-start gap-4">
                                            <div
                                                className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-violet-950 via-purple-800 to-fuchsia-500 shadow-sm"
                                                aria-hidden="true"
                                            >
                                                <Ticket className="size-8 text-white/90" />
                                            </div>
                                            <div className="min-w-0">
                                                <h2 className="font-semibold">{draft.movieTitle}</h2>
                                                <Badge variant="outline" className="mt-2">
                                                    ★ {draft.movieRating} / 10
                                                </Badge>
                                                <p className="text-muted-foreground mt-2 text-sm">Hall {draft.hallNumber}</p>
                                            </div>
                                        </div>
                                        <div className="text-muted-foreground flex flex-col gap-3 border-t pt-4 text-sm">
                                            <p className="flex items-start gap-2">
                                                <CalendarDays className="mt-0.5 size-4 shrink-0" />
                                                <span>{formatShowtime(draft.showtimeStart)}</span>
                                            </p>
                                            <p className="flex items-center gap-2">
                                                <Armchair className="size-4 shrink-0" />
                                                Seat {draft.seatCode} · {draft.ticketType}
                                            </p>
                                            <p className="break-all">{draft.customerEmail}</p>
                                        </div>
                                        <div className="space-y-3 border-t pt-4 text-sm">
                                            <div className="flex justify-between gap-3">
                                                <span className="text-muted-foreground">Ticket price</span>
                                                <span>{formatCurrency(draft.ticketPrice)}</span>
                                            </div>
                                            <div className="flex justify-between gap-3">
                                                <span className="text-muted-foreground">Service fee</span>
                                                <span>{formatCurrency(draft.serviceFee)}</span>
                                            </div>
                                            <div className="flex justify-between border-t pt-3 text-base font-semibold">
                                                <span>Total amount</span>
                                                <span>{formatCurrency(draft.ticketPrice + draft.serviceFee)}</span>
                                            </div>
                                            <p className="text-muted-foreground text-xs">No service fee is currently applied.</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Payment method</CardTitle>
                                        <CardDescription>Choose how you plan to settle this booking.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid gap-3">
                                        {paymentMethods.map(({ value, label, detail, icon: Icon }) => (
                                            <button
                                                key={value}
                                                type="button"
                                                aria-pressed={paymentMethod === value}
                                                onClick={() => setPaymentMethod(value)}
                                                className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                                                    paymentMethod === value ? 'border-primary bg-primary/5 ring-primary ring-1' : 'hover:bg-muted/40'
                                                }`}
                                            >
                                                <span
                                                    className={`size-4 rounded-full border ${paymentMethod === value ? 'border-primary border-[5px]' : 'border-muted-foreground'}`}
                                                />
                                                <span>
                                                    <span className="block font-medium">{label}</span>
                                                    <span className="text-muted-foreground mt-1 block text-sm">{detail}</span>
                                                </span>
                                                <span className="bg-muted text-primary rounded-lg p-2.5">
                                                    <Icon className="size-5" />
                                                </span>
                                            </button>
                                        ))}
                                        <div className="mt-3 flex flex-col-reverse justify-between gap-3 sm:flex-row">
                                            <Button variant="outline" asChild>
                                                <Link href="/booking">Back to seat selection</Link>
                                            </Button>
                                            <Button onClick={() => void confirmBooking()} disabled={submitting}>
                                                {submitting && <LoaderCircle className="animate-spin" />}
                                                Confirm booking
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    ) : (
                        <Card>
                            <CardContent className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
                                <LoaderCircle className="size-4 animate-spin" />
                                Loading your booking…
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </AppLayout>
    );
}
