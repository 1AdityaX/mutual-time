import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

// Redirect to homepage if someone tries to navigate to /logout directly
export const load: PageServerLoad = async () => {
	throw redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ cookies }) => {
		// Clear the 'username' cookie
		cookies.delete('username', { path: '/' });

		// Redirect to the homepage
		throw redirect(303, '/');
	}
};
