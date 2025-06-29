import { fail, redirect } from '@sveltejs/kit';
import { addUser, getUsers } from '$lib/server/database';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	// Get the redirect URL from query parameters
	const redirectTo = url.searchParams.get('redirect') || '/';
	return { redirectTo };
};

export const actions: Actions = {
	/**
	 * Action to handle user signup.
	 */
	signup: async ({ request }) => {
		const data = await request.formData();
		const username = data.get('username') as string | null;
		const password = data.get('password') as string | null;

		if (!username || !password || username.trim().length < 3 || password.length < 4) {
			return fail(400, {
				success: false,
				message: 'Username must be at least 3 characters and password at least 4.'
			});
		}

		const users = await getUsers();
		const userExists = users.some((u) => u.username.toLowerCase() === username.toLowerCase());

		if (userExists) {
			return fail(400, { success: false, message: `Username "${username}" is already taken.` });
		}

		// In a real app, hash the password here before saving!
		await addUser({ username, password });

		return {
			success: true,
			message: 'Account created successfully! Please log in.'
		};
	},

	/**
	 * Action to handle user login.
	 */
	login: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const username = data.get('username') as string | null;
		const password = data.get('password') as string | null;

		if (!username || !password) {
			return fail(400, { success: false, message: 'Both username and password are required.' });
		}

		const users = await getUsers();
		const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());

		if (!user || user.password !== password) {
			return fail(401, { success: false, message: 'Invalid username or password.' });
		}

		// Set the cookie to "log in" the user
		cookies.set('username', user.username, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7, // 1 week
			secure: false // Set to true in production with HTTPS
		});

		// Get the redirect URL from query parameters, default to homepage
		const redirectTo = url.searchParams.get('redirect') || '/';

		// Redirect to the intended page after successful login
		throw redirect(303, redirectTo);
	}
};
