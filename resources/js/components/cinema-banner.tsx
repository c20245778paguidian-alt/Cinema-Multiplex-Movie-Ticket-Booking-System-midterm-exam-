import { Clapperboard, Film, Sparkles } from 'lucide-react';

export function CinemaBanner() {
    return (
        <section
            aria-label="Cinema Multiplex"
            className="relative isolate mx-4 mt-4 flex min-h-24 items-center justify-between overflow-hidden rounded-2xl border border-violet-300/15 bg-[#100d26] px-5 py-4 text-white shadow-lg shadow-violet-950/10 sm:mx-6 sm:mt-6 sm:px-7"
        >
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_18%_50%,rgba(124,58,237,0.42),transparent_38%),radial-gradient(ellipse_at_82%_0%,rgba(217,70,239,0.28),transparent_35%),linear-gradient(110deg,#100d26_15%,#211148_56%,#080d20)]" />
            <div className="absolute inset-y-0 right-0 -z-10 w-1/2 [background-image:linear-gradient(90deg,transparent_49%,white_50%,transparent_51%),linear-gradient(transparent_49%,white_50%,transparent_51%)] [background-size:22px_22px] opacity-20" />

            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner sm:size-14">
                    <Film className="size-7 text-violet-100 sm:size-8" />
                </span>
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold tracking-[0.24em] text-violet-200 uppercase sm:text-xs">Cinema Multiplex</p>
                    <p className="mt-1 truncate text-lg leading-tight font-bold tracking-tight sm:text-2xl">Movie Ticket Booking System</p>
                    <p className="mt-1 hidden items-center gap-1.5 text-xs text-violet-100/70 sm:flex">
                        <Sparkles className="size-3" />
                        Book · Watch · Enjoy
                    </p>
                </div>
            </div>

            <div className="ml-3 hidden items-center gap-3 text-violet-100/80 sm:flex">
                <span className="text-right text-xs leading-5">
                    Your next
                    <br />
                    show starts here
                </span>
                <Clapperboard className="size-10 text-fuchsia-200/80" />
            </div>
        </section>
    );
}
