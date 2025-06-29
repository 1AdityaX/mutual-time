import { error, fail } from '@sveltejs/kit';
import {
	getEventByCode,
	updateEvent,
	type TimeSlot,
	getUserEvents,
	addUserToEvent
} from '$lib/server/database';
import { requireAuth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

// The load function from the previous step remains unchanged
export const load: PageServerLoad = async ({ params, parent }) => {
	const { code } = params;
	const { user } = await parent();

	if (!code) {
		throw error(404, 'Event not found');
	}

	const event = await getEventByCode(code);

	if (!event) {
		throw error(404, {
			message: `Sorry, we couldn't find an event with the code "${code}". Please check the code and try again.`
		});
	}

	// Get user events if user is logged in
	let userEvents: any[] = [];
	if (user?.username) {
		userEvents = await getUserEvents(user.username);
	}

	return {
		event,
		userEvents
	};
};

// We are now adding the 'actions' object to this file
export const actions: Actions = {
	/**
	 * Action to update a participant's availability for an event.
	 */
	update: async ({ request, params, cookies, url }) => {
		// Require authentication for updating availability
		requireAuth({ cookies, url } as any);

		const { code } = params;
		const username = cookies.get('username');
		const data = await request.formData();

		const participantName = data.get('username') as string | null;
		const selectionsJSON = data.get('selections') as string | null;

		// Validation
		if (!participantName || participantName.trim().length === 0) {
			return fail(400, { success: false, message: 'A username is required to save availability.' });
		}
		if (!selectionsJSON) {
			return fail(400, { success: false, message: 'No selection data received.' });
		}

		let selections: TimeSlot[];
		try {
			selections = JSON.parse(selectionsJSON);
		} catch (e) {
			return fail(400, { success: false, message: 'Invalid selection format.' });
		}

		// Database Update
		const event = await getEventByCode(code);
		if (!event) {
			return fail(404, { success: false, message: 'Event not found.' });
		}

		// Update the participants object with the new data for this user
		event.participants[participantName.trim()] = selections;

		// Save the entire updated event object back to the database
		await updateEvent(event);

		// Track that this user has joined this event
		if (username) {
			await addUserToEvent(username, code);
		}

		// Success Response
		return {
			success: true,
			event
		};
	}
};
