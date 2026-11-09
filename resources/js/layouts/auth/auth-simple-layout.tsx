import { Link } from '@inertiajs/react';
import { ArrowLeft, Clapperboard, Film, Popcorn, Sparkles, Ticket } from 'lucide-react';

interface AuthLayoutProps {
    children: React.ReactNode;
    name?: string;
    title?: string;
    description?: string;
}

export default function AuthSimpleLayout({ children, title, description }: AuthLayoutProps) {
    return (
        <main className="bg-background min-h-svh lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
            <section className="relative hidden min-h-svh overflow-hidden bg-zinc-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_22%,rgba(190,24,93,0.3),transparent_42%),radial-gradient(ellipse_at_15%_85%,rgba(124,58,237,0.2),transparent_40%)]" />
                <div className="absolute inset-0 [background-image:linear-gradient(90deg,transparent_49%,white_50%,transparent_51%),linear-gradient(transparent_49%,white_50%,transparent_51%)] [background-size:48px_48px] opacity-[0.08]" />

                <Link href={route('home')} className="relative z-10 inline-flex w-fit items-center gap-3 font-semibold tracking-tight">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-white text-zinc-950">
                        <Film className="size-6" />
                    </span>
                    Cinema Multiplex
                </Link>

                <div className="relative z-10 mx-auto w-full max-w-xl py-12">
                    <div className="relative mx-auto mb-12 flex aspect-[1.55] max-w-lg items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 shadow-2xl shadow-fuchsia-950/30">
                        <div className="absolute inset-x-0 top-0 h-3 bg-[radial-gradient(circle,white_3px,transparent_4px)] bg-[length:24px_12px] opacity-60" />
                        <div className="absolute inset-x-0 bottom-0 h-3 bg-[radial-gradient(circle,white_3px,transparent_4px)] bg-[length:24px_12px] opacity-60" />
                        <div className="absolute top-10 left-10 size-32 rounded-full bg-fuchsia-600/30 blur-3xl" />
                        <div className="absolute right-8 bottom-8 size-36 rounded-full bg-indigo-500/30 blur-3xl" />
                        <div className="relative flex flex-col items-center gap-5">
                            <div className="flex size-24 items-center justify-center rounded-3xl border border-white/10 bg-white/5 shadow-inner">
                                <Clapperboard className="size-12 text-fuchsia-200" />
                            </div>
                            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-zinc-300 backdrop-blur">
                                <Sparkles className="size-4 text-amber-300" />
                                Every great night starts here
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm font-medium tracking-[0.22em] text-fuchsia-200 uppercase">Your cinema, in sync</p>
                        <h1 className="text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
                            Make room for
                            <br />
                            <span className="text-zinc-400">movie magic.</span>
                        </h1>
                        <p className="max-w-md text-base leading-7 text-zinc-400">
                            Manage screenings, halls, seats and bookings, all from one easy-to-use cinema workspace.
                        </p>
                    </div>
                </div>

                <div className="relative z-10 flex items-center justify-between text-sm text-zinc-500">
                    <span>Made for the love of movies.</span>
                    <span className="flex items-center gap-2">
                        <Popcorn className="size-4" />
                        Your next show starts here
                    </span>
                </div>
            </section>

            <section className="flex min-h-svh flex-col px-5 py-6 sm:px-10 lg:px-12">
                <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
                    <Link
                        href={route('home')}
                        className="text-muted-foreground hover:text-foreground mb-8 inline-flex w-fit items-center gap-2 text-sm transition-colors lg:hidden"
                    >
                        <ArrowLeft className="size-4" />
                        Back to home
                    </Link>
                    <Link href={route('home')} className="mb-9 hidden w-fit items-center gap-3 font-semibold tracking-tight lg:inline-flex">
                        <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
                            <Ticket className="size-5" />
                        </span>
                        Cinema Multiplex
                    </Link>

                    <div className="mb-8 space-y-2">
                        <p className="text-primary text-sm font-medium">WELCOME TO THE MULTIPLEX</p>
                        <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
                        <p className="text-muted-foreground text-sm leading-6">{description}</p>
                    </div>

                    {children}
                </div>
                <footer className="text-muted-foreground mx-auto flex w-full max-w-md items-center justify-between gap-4 border-t py-5 text-xs">
                    <span>© {new Date().getFullYear()} Cinema Multiplex</span>
                    <span>Lights down. Let’s begin.</span>
                </footer>
            </section>
        </main>
    );
}
