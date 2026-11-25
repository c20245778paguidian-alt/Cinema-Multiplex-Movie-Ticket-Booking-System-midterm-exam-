import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { requestJson } from '@/lib/cinema-api';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Clapperboard, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Movie = {
    id: number;
    title: string;
    rating: string;
};

type ShowtimeDependencies = {
    movies: Movie[];
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Movies', href: '/movies' }];
const MOVIES_PER_PAGE = 5;
const posterTones = [
    'from-violet-950 via-purple-800 to-fuchsia-500',
    'from-slate-950 via-slate-700 to-orange-500',
    'from-blue-950 via-indigo-700 to-cyan-400',
    'from-rose-950 via-red-800 to-amber-400',
    'from-emerald-950 via-teal-700 to-lime-400',
];

function isNumericRating(value: string): boolean {
    return /^\d+(?:\.\d+)?$/.test(value.trim());
}

export default function Movies() {
    const [movies, setMovies] = useState<Movie[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
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
            const catalog = await requestJson<ShowtimeDependencies>('/showtimes/create');
            setMovies(catalog.movies);
            setCurrentPage((page) => Math.min(page, Math.max(1, Math.ceil(catalog.movies.length / MOVIES_PER_PAGE))));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to load movies.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadMovies();
    }, [loadMovies]);

    const pageCount = Math.max(1, Math.ceil(movies.length / MOVIES_PER_PAGE));
    const firstMovieIndex = (currentPage - 1) * MOVIES_PER_PAGE;
    const visibleMovies = movies.slice(firstMovieIndex, firstMovieIndex + MOVIES_PER_PAGE);
    const firstPageNumber = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
    const pageNumbers = Array.from({ length: Math.min(pageCount, 5) }, (_, index) => firstPageNumber + index);

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
        const creatingMovie = !editingMovie;

        try {
            const url = editingMovie ? `/movies/${editingMovie.id}` : '/movies';
            await requestJson<Movie>(url, {
                method: editingMovie ? 'PUT' : 'POST',
                body: JSON.stringify({ title, rating }),
            });
            setFormOpen(false);
            if (creatingMovie) setCurrentPage(1);
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
                            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Movies Management</h1>
                            <p className="text-muted-foreground mt-2">Add, edit, and remove movies shown in the booking system.</p>
                        </div>
                        {!formOpen && (
                            <Button onClick={openCreateForm}>
                                <Plus />
                                Add Movie
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
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[640px] text-left text-sm">
                                            <thead>
                                                <tr className="text-muted-foreground border-b text-xs font-medium tracking-wide uppercase">
                                                    <th scope="col" className="w-14 px-3 py-3">
                                                        #
                                                    </th>
                                                    <th scope="col" className="w-20 px-3 py-3">
                                                        Poster
                                                    </th>
                                                    <th scope="col" className="px-3 py-3">
                                                        Title
                                                    </th>
                                                    <th scope="col" className="w-28 px-3 py-3">
                                                        Rating
                                                    </th>
                                                    <th scope="col" className="w-44 px-3 py-3 text-right">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {visibleMovies.map((movie, index) => (
                                                    <tr key={movie.id} className="hover:bg-muted/30 transition-colors">
                                                        <td className="text-muted-foreground px-3 py-3.5">{firstMovieIndex + index + 1}</td>
                                                        <td className="px-3 py-3">
                                                            <div
                                                                className={`flex h-14 w-10 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br ${
                                                                    posterTones[(firstMovieIndex + index) % posterTones.length]
                                                                } shadow-sm`}
                                                                aria-hidden="true"
                                                            >
                                                                <Clapperboard className="size-5 text-white/90" />
                                                            </div>
                                                        </td>
                                                        <th scope="row" className="px-3 py-3.5 text-left font-medium">
                                                            {movie.title}
                                                        </th>
                                                        <td className="px-3 py-3.5">
                                                            <Badge variant="outline">{movie.rating}</Badge>
                                                        </td>
                                                        <td className="px-3 py-3.5">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    className="bg-blue-600 text-white hover:bg-blue-700"
                                                                    onClick={() => openEditForm(movie)}
                                                                >
                                                                    <Pencil />
                                                                    Edit
                                                                </Button>
                                                                <Button size="sm" variant="destructive" onClick={() => void deleteMovie(movie)}>
                                                                    <Trash2 />
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {pageCount > 1 && (
                                        <div className="text-muted-foreground mt-4 flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                                            <span>
                                                Showing {firstMovieIndex + 1}–{Math.min(firstMovieIndex + visibleMovies.length, movies.length)} of{' '}
                                                {movies.length} movies
                                            </span>
                                            <nav className="flex items-center justify-center gap-2" aria-label="Movie pages">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={currentPage === 1}
                                                    onClick={() => setCurrentPage((page) => page - 1)}
                                                >
                                                    Previous
                                                </Button>
                                                {pageNumbers.map((page) => (
                                                    <Button
                                                        key={page}
                                                        size="sm"
                                                        variant={page === currentPage ? 'default' : 'outline'}
                                                        aria-current={page === currentPage ? 'page' : undefined}
                                                        aria-label={`Page ${page}`}
                                                        onClick={() => setCurrentPage(page)}
                                                    >
                                                        {page}
                                                    </Button>
                                                ))}
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={currentPage === pageCount}
                                                    onClick={() => setCurrentPage((page) => page + 1)}
                                                >
                                                    Next
                                                </Button>
                                            </nav>
                                        </div>
                                    )}
                                </>
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
