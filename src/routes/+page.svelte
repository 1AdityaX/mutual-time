<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Toaster, toast } from 'svelte-sonner';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import type { DateValue } from '@internationalized/date';

	let { form, data } = $props();

	// Svelte 5 state rune for the Calendar
	let selectedDate = $state<DateValue[]>([]);

	// Svelte 5 effect rune to show toast messages from the server
	$effect(() => {
		if (form?.message) {
			if (form.success) {
				toast.success(form.message);
			} else {
				toast.error(form.message);
			}
		}
	});

	// Function to handle form submission with validation
	function handleCreateSubmit(event: SubmitEvent) {
		if (selectedDate.length === 0) {
			event.preventDefault();
			toast.error('Please select at least one date for your event.');
			return;
		}
	}

	// Check if user is logged in
	const isLoggedIn = !!data.user;
</script>

<Toaster richColors />

<div class="container py-10">
	<div class="mx-auto flex max-w-4xl flex-col items-center text-center">
		<h1 class="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
			Find the Perfect Time to Meet
		</h1>
		<p class="text-muted-foreground mt-6 max-w-2xl text-lg">
			Create a shared calendar, invite your team, and instantly find mutual availability for your
			selected dates.
		</p>
	</div>

	<div class="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
		<!-- Create Event Card -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Create a New Event</Card.Title>
				<Card.Description>
					{#if isLoggedIn}
						Select one or more dates for your event and we'll generate a unique code for you to
						share.
					{:else}
						Please log in to create events and manage your schedule.
					{/if}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if isLoggedIn}
					<form method="POST" action="?/create" use:enhance onsubmit={handleCreateSubmit}>
						<div class="grid w-full items-center gap-4">
							<div class="flex flex-col space-y-1.5">
								<Label for="week">Pick Dates</Label>
								<Calendar bind:value={selectedDate} type="multiple" weekStartsOn={1} />
							</div>
							<!-- Hidden input to submit the selected date -->
							{#if selectedDate.length > 0}
								<input
									type="hidden"
									name="selectedDates"
									value={JSON.stringify(
										selectedDate.map((date) => date.toDate('UTC').toISOString().split('T')[0])
									)}
								/>
							{/if}
							<Button class="w-full" type="submit" disabled={selectedDate.length === 0}
								>Create Event</Button
							>
						</div>
					</form>
				{:else}
					<div class="flex flex-col items-center gap-4 py-8">
						<p class="text-muted-foreground text-center">
							You need to be logged in to create events.
						</p>
						<Button href="/login" class="w-full">Login to Create Events</Button>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<!-- Join Event Card -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Join an Existing Event</Card.Title>
				<Card.Description>
					{#if isLoggedIn}
						Enter the event code you received to add your availability.
					{:else}
						Please log in to join events and contribute your availability.
					{/if}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if isLoggedIn}
					<form method="POST" action="?/join" use:enhance>
						<div class="grid w-full items-center gap-4">
							<div class="flex flex-col space-y-1.5">
								<Label for="code">Event Code</Label>
								<Input id="code" name="code" placeholder="e.g., xyz-123" required />
							</div>
							<Button class="w-full" type="submit">Join Event</Button>
						</div>
					</form>
				{:else}
					<div class="flex flex-col items-center gap-4 py-8">
						<p class="text-muted-foreground text-center">
							You need to be logged in to join events.
						</p>
						<Button href="/login" class="w-full">Login to Join Events</Button>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
