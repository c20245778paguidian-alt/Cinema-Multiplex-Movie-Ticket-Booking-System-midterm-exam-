import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { requestJson } from '@/lib/cinema-api';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Clapperboard, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Movie = {
    id: number;
    title: string;
    rating: string;
};

type Showtime = {
    id: number;
    showtime_start: string;
    movie: Movie;
};

type ShowtimeDependencies = {
    movies: Movie[];
};

type Paginated<T> = {
    data: T[];
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Movies', href: '/movies' }];

function isNumericRating(value: string): boolean {
    return /^\d+(?:\.\d+)?$/.test(value.trim());
}

export default function Movies() {
    const [movies, setMovies] = useState<Movie[]>([]);
    const [showtimes, setShowtimes] = useState<Showtime[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
    const [title, setTitle] = useState('');
    const [rating, setRating] = useState('');

    const loadMovies = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const [catalog, schedule] = await Promise.all([
                requestJson<ShowtimeDependencies>('/showtimes/create'),
                requestJson<Paginated<Showtime>>('/showtimes'),
            ]);
            setMovies(catalog.movies);
            setShowtimes(schedule.data);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to load movies.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadMovies();
    }, [loadMovies]);

    function openCreateForm() {
        setEditingMovie(null);
        setTitle('');
        setRating('');
        setFormError(null);
        setFormOpen(true);
    }

    function openEditForm(movie: Movie) {
        setEditingMovie(movie);
        setTitle(movie.title);
        setRating(movie.rating);
        setFormError(null);
        setFormOpen(true);
    }

    async function saveMovie(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!isNumericRating(rating)) {
            setFormError('Rating must contain numbers only; decimals are allowed.');
            return;
        }

        setSubmitting(true);
        setFormError(null);

        try {
            const url = editingMovie ? `/movies/${editingMovie.id}` : '/movies';
            await requestJson<Movie>(url, {
                method: editingMovie ? 'PUT' : 'POST',
                body: JSON.stringify({ title, rating }),
            });
            setFormOpen(false);
            await loadMovies();
        } catch (reason) {
            setFormError(reason instanceof Error ? reason.message : 'Unable to save this movie.');
        } finally {
            setSubmitting(false);
        }
    }

    async function deleteMovie(movie: Movie) {
        if (!window.confirm(`Delete "${movie.title}" from the catalog?`)) return;
        setError(null);

        try {
            await requestJson<{ message: string }>(`/movies/${movie.id}`, { method: 'DELETE' });
            await loadMovies();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to delete this movie.');
        }
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Movie management" />
            <main className="bg-muted/20 min-h-full">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
                    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-muted-foreground text-sm font-medium">Cinema catalog</p>
                            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Movies</h1>
                            <p className="text-muted-foreground mt-2">Manage titles and ratings available for screenings.</p>
                        </div>
                        {!formOpen && (
                            <Button onClick={openCreateForm}>
                                <Plus />
                                Add movie
                            </Button>
                        )}
                    </header>

                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Movie catalog error</AlertTitle>
                            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <span>{error}</span>
                                <Button size="sm" variant="outline" onClick={() => void loadMovies()}>
                                    Try again
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    {formOpen && (
                        <Card>
                            <CardHeader>
                                <CardTitle>{editingMovie ? 'Edit movie' : 'Add a movie'}</CardTitle>
                                <CardDescription>Movie information is saved to your cinema catalog.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form className="grid gap-4 sm:grid-cols-[1fr_180px_auto_auto]" onSubmit={saveMovie}>
                                    <div className="grid gap-2">
                                        <Label htmlFor="movie-title">Movie title</Label>
                                        <Input
                                            id="movie-title"
                                            value={title}
                                            onChange={(event) => setTitle(event.target.value)}
                                            maxLength={255}
                                            required
                                            autoFocus
                                            placeholder="e.g. The Grand Premiere"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="movie-rating">Rating</Label>
                                        <Input
                                            id="movie-rating"
                                            value={rating}
                                            maxLength={10}
                                            inputMode="decimal"
                                            pattern="[0-9]+(\\.[0-9]+)?"
                                            aria-invalid={Boolean(rating) && !isNumericRating(rating)}
                                            required
                                            placeholder="e.g. 8.5"
                                            onChange={(event) => {
                                                setFormError(null);
                                                setRating(event.target.value);
                                            }}
                                        />
                                        {rating && !isNumericRating(rating) && (
                                            <p className="text-destructive text-sm">Rating must contain numbers only; decimals are allowed.</p>
                                        )}
                                    </div>
                                    <div className="flex items-end">
                                        <Button type="submit" disabled={submitting}>
                                            {submitting && <LoaderCircle className="animate-spin" />}
                                            Save movie
                                        </Button>
                                    </div>
                                    <div className="flex items-end">
                                        <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
                                            Cancel
                                        </Button>
                                    </div>
                                </form>
                                {formError && <p className="text-destructive mt-3 text-sm">{formError}</p>}
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-4">
                            <div>
                                <CardTitle>Movie library</CardTitle>
                                <CardDescription>
                                    {movies.length} {movies.length === 1 ? 'title' : 'titles'} in your catalog
                                </CardDescription>
                            </div>
                            <Clapperboard className="text-muted-foreground size-5" />
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Loading movies…
                                </div>
                            ) : movies.length ? (
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {movies.map((movie) => {
                                        const movieShowtimes = showtimes.filter((showtime) => showtime.movie.id === movie.id).length;

                                        return (
                                            <article key={movie.id} className="bg-card rounded-xl border p-5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                                                        <Clapperboard className="size-5" />
                                                    </div>
                                                    <Badge variant="outline">{movie.rating}</Badge>
                                                </div>
                                                <h2 className="mt-4 text-lg font-semibold">{movie.title}</h2>
                                                <p className="text-muted-foreground mt-1 text-sm">
                                                    {movieShowtimes} upcoming {movieShowtimes === 1 ? 'screening' : 'screenings'}
                                                </p>
                                                <div className="mt-5 flex flex-wrap gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => openEditForm(movie)}>
                                                        <Pencil />
                                                        Edit
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => void deleteMovie(movie)}>
                                                        <Trash2 />
                                                        Delete
                                                    </Button>
                                                    <Button size="sm" variant="ghost" asChild>
                                                        <Link href="/booking">Book a seat</Link>
                                                    </Button>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center rounded-xl border border-dashed py-12 text-center">
                                    <Clapperboard className="text-muted-foreground size-8" />
                                    <p className="mt-3 font-medium">Your movie catalog is empty</p>
                                    <p className="text-muted-foreground mt-1 text-sm">Add a movie before scheduling a screening.</p>
                                    {!formOpen && (
                                        <Button className="mt-4" onClick={openCreateForm}>
                                            <Plus />
                                            Add your first movie
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </AppLayout>
    );
}
