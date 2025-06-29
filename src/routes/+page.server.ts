import { fail, redirect } from '@sveltejs/kit';
import { getEventByCode, updateEvent } from '$lib/server/database';
import { startOfWeek, parseISO } from 'date-fns';
import { requireAuth } from '$lib/server/auth';
import type { Actions } from './$types';

// A helper function to format a Date object into 'YYYY-MM-DD' string
const formatDate = (date: Date) => date.toISOString().split('T')[0];

export const actions: Actions = {
	/**
	 * Action to create a new event.
	 */
	create: async ({ request, cookies, url }) => {
		// Require authentication for creating events
		requireAuth({ cookies, url } as any);

		const data = await request.formData();
		const selectedDatesJSON = data.get('selectedDates') as string | null;

		if (!selectedDatesJSON) {
			return fail(400, {
				success: false,
				message: 'Please select at least one date for your event.'
			});
		}

		let selectedDates: string[];
		try {
			selectedDates = JSON.parse(selectedDatesJSON);
		} catch (e) {
			return fail(400, { success: false, message: 'Invalid date format.' });
		}

		if (selectedDates.length === 0) {
			return fail(400, {
				success: false,
				message: 'Please select at least one date for your event.'
			});
		}

		// Generate a simple, random, URL-friendly code
		const newCode = Math.random().toString(36).substring(2, 9);

		await updateEvent({
			code: newCode,
			selectedDates: selectedDates,
			participants: {}
		});

		// Redirect to the newly created event page
		throw redirect(303, `/event/${newCode}`);
	},

	/**
	 * Action to join an existing event.
	 */
	join: async ({ request, cookies, url }) => {
		// Require authentication for joining events
		requireAuth({ cookies, url } as any);

		const data = await request.formData();
		const code = data.get('code') as string | null;

		if (!code || code.trim().length === 0) {
			return fail(400, { success: false, message: 'Please enter an event code.' });
		}

		const event = await getEventByCode(code.trim());

		if (event) {
			// If event exists, redirect to its page
			throw redirect(303, `/event/${code.trim()}`);
		} else {
			// If not, return an error message to be displayed in a toast
			return fail(404, { success: false, message: `Event with code "${code}" not found.` });
		}
	}
};
