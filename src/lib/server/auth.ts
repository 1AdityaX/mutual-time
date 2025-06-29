import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Check if a user is authenticated and redirect to login if not
 * @param event - The SvelteKit request event
 * @param redirectTo - Optional redirect path after login (defaults to current URL)
 */
export function requireAuth(event: RequestEvent, redirectTo?: string): void {
	const username = event.cookies.get('username');

	if (!username) {
		const currentUrl = event.url.pathname + event.url.search;
		const loginRedirect = redirectTo || currentUrl;
		throw redirect(303, `/login?redirect=${encodeURIComponent(loginRedirect)}`);
	}
}

/**
 * Check if a user is authenticated (returns boolean, doesn't redirect)
 * @param event - The SvelteKit request event
 * @returns true if user is authenticated, false otherwise
 */
export function isAuthenticated(event: RequestEvent): boolean {
	const username = event.cookies.get('username');
	return !!username;
}

/**
 * Get the current authenticated username
 * @param event - The SvelteKit request event
 * @returns username if authenticated, null otherwise
 */
export function getCurrentUser(event: RequestEvent): string | null {
	return event.cookies.get('username') || null;
}
