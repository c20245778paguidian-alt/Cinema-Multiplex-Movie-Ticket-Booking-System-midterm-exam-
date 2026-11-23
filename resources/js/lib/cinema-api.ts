export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
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

export function formatCurrency(value: number | string): string {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(Number(value));
}
