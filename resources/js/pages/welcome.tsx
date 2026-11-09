import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, CalendarDays, Clapperboard, Film, Ticket, Users } from 'lucide-react';

const features = [
    {
        icon: CalendarDays,
        title: 'Plan every screening',
        description: 'Schedule movies across your halls and keep upcoming shows organized.',
    },
    {
        icon: Ticket,
        title: 'Manage every booking',
        description: 'Reserve seats, calculate ticket totals, and track payment status.',
    },
    {
        icon: Users,
        title: 'Keep your team in sync',
        description: 'Bring your cinema operations together in one simple workspace.',
    },
];

export default function Welcome() {
    const { auth } = usePage<SharedData>().props;

    return (
        <>
            <Head title="Cinema Multiplex">
                <meta name="description" content="Manage movie screenings, cinema halls, seats and bookings with Cinema Multiplex." />
            </Head>
            <main className="min-h-svh overflow-hidden bg-zinc-950 text-white">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_5%,rgba(190,24,93,0.2),transparent_38%),radial-gradient(ellipse_at_5%_55%,rgba(79,70,229,0.16),transparent_35%)]" />
                <div className="relative mx-auto flex min-h-svh w-full max-w-7xl flex-col px-5 sm:px-8">
                    <header className="flex items-center justify-between border-b border-white/10 py-5">
                        <Link href="/" className="inline-flex items-center gap-3 font-semibold tracking-tight">
                            <span className="flex size-10 items-center justify-center rounded-xl bg-white text-zinc-950">
                                <Film className="size-5" />
                            </span>
                            Cinema Multiplex
                        </Link>
                        <nav aria-label="Account" className="flex items-center gap-2 sm:gap-3">
                            {auth.user ? (
                                <Button asChild>
                                    <Link href={route('dashboard')}>
                                        Open dashboard
                                        <ArrowRight />
                                    </Link>
                                </Button>
                            ) : (
                                <>
                                    <Button asChild variant="ghost" className="text-zinc-200 hover:bg-white/10 hover:text-white">
                                        <Link href={route('login')}>Log in</Link>
                                    </Button>
                                    <Button asChild className="bg-white text-zinc-950 hover:bg-zinc-200">
                                        <Link href={route('register')}>Create account</Link>
                                    </Button>
                                </>
                            )}
                        </nav>
                    </header>

                    <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
                        <div className="max-w-2xl">
                            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-300">
                                <Clapperboard className="size-4 text-fuchsia-200" />
                                Your cinema operations, simplified
                            </div>
                            <h1 className="text-5xl leading-[1.08] font-semibold tracking-tight sm:text-6xl xl:text-7xl">
                                Bring the
                                <br />
                                <span className="bg-gradient-to-r from-fuchsia-200 via-rose-200 to-amber-100 bg-clip-text text-transparent">
                                    big screen
                                </span>
                                <br />
                                to life.
                            </h1>
                            <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">
                                From showtimes to the last seat in the house, run your multiplex with one clear, easy-to-use workspace.
                            </p>
                            <div className="mt-9 flex flex-wrap gap-3">
                                {auth.user ? (
                                    <Button asChild size="lg" className="bg-white text-zinc-950 hover:bg-zinc-200">
                                        <Link href={route('dashboard')}>
                                            Go to dashboard
                                            <ArrowRight />
                                        </Link>
                                    </Button>
                                ) : (
                                    <>
                                        <Button asChild size="lg" className="bg-white text-zinc-950 hover:bg-zinc-200">
                                            <Link href={route('register')}>
                                                Get started
                                                <ArrowRight />
                                            </Link>
                                        </Button>
                                        <Button
                                            asChild
                                            size="lg"
                                            variant="outline"
                                            className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                                        >
                                            <Link href={route('login')}>Log in to your account</Link>
                                        </Button>
                                    </>
                                )}
                            </div>
                            <p className="mt-4 text-sm text-zinc-500">
                                {auth.user ? 'Welcome back to your cinema workspace.' : 'Create an account to start managing your multiplex.'}
                            </p>
                        </div>

                        <div className="relative mx-auto w-full max-w-xl">
                            <div className="absolute -inset-8 rounded-full bg-fuchsia-600/10 blur-3xl" />
                            <Card className="relative overflow-hidden rounded-3xl border-white/10 bg-zinc-900/80 text-white shadow-2xl shadow-black/40 backdrop-blur">
                                <CardContent className="p-0">
                                    <div className="border-b border-white/10 p-6 sm:p-8">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-zinc-400">CINEMA CONTROL ROOM</p>
                                                <h2 className="mt-1 text-xl font-semibold">Everything in one place</h2>
                                            </div>
                                            <span className="flex size-12 items-center justify-center rounded-2xl bg-fuchsia-400/10 text-fuchsia-200">
                                                <Clapperboard className="size-6" />
                                            </span>
                                        </div>
                                        <div className="mt-7 flex items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-950 py-12">
                                            <div className="relative flex size-36 items-center justify-center rounded-full border border-fuchsia-200/20 bg-fuchsia-300/5">
                                                <div className="absolute inset-3 rounded-full border border-white/10" />
                                                <Film className="size-14 text-fuchsia-100" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                                        {features.map(({ icon: Icon, title, description }) => (
                                            <div key={title} className="p-5">
                                                <Icon className="mb-3 size-5 text-fuchsia-200" />
                                                <h3 className="text-sm font-medium">{title}</h3>
                                                <p className="mt-1.5 text-xs leading-5 text-zinc-400">{description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </section>

                    <footer className="flex flex-col gap-2 border-t border-white/10 py-5 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                        <span>© {new Date().getFullYear()} Cinema Multiplex</span>
                        <span>Made for the love of movies.</span>
                    </footer>
                </div>
            </main>
        </>
    );
}
