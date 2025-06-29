import type { LayoutServerLoad } from './$types';
import { getUserEvents } from '$lib/server/database';

export const load: LayoutServerLoad = async ({ locals, cookies, url }) => {
	// Our simple "session" is just a username stored in a cookie.
	// In a real app, this would be a secure, HTTP-only session cookie
	// containing a session ID, not the user's raw username.
	const username = cookies.get('username');

	// Get user events if user is logged in
	let userEvents: any[] = [];
	if (username) {
		userEvents = await getUserEvents(username);
	}

	// Extract current event code from URL if we're on an event page
	const pathname = url.pathname;
	const eventMatch = pathname.match(/^\/event\/([^\/]+)$/);
	const currentEventCode = eventMatch ? eventMatch[1] : null;

	// Make the username available to the +layout.svelte component and all pages
	return {
		user: username ? { username } : null,
		userEvents,
		currentEventCode
	};
};
