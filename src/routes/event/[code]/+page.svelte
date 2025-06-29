<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { addDays, addMinutes, format, parseISO } from 'date-fns';

	import type { Event, TimeSlot } from '$lib/server/database';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import InviteCodeDropdown from '$lib/components/InviteCodeDropdown.svelte';

	// --- PROPS & STORES ---
	let { data, form } = $props();
	const eventData: Event = data.event;
	const userEvents = (data as any).userEvents || [];
	const loggedInUser = page.data.user;

	// --- STATE MANAGEMENT (Svelte 5 Runes) ---

	// The event data, which can be updated after form submission
	let event = $state(eventData);

	// The current user's name for this session
	let participantName = $state(loggedInUser?.username || '');

	// The user's selections in this session, as an array of TimeSlot objects
	let mySelections = $state<TimeSlot[]>([]);

	// Generate the week's dates and time slots for the UI grid
	const timeInterval = 30; // 30-minute slots

	// Handle multiple selected dates instead of just a single week
	const selectedDates = $derived(() => {
		if (event.selectedDates && event.selectedDates.length > 0) {
			return event.selectedDates.map((dateStr) => parseISO(dateStr + 'T00:00:00.000Z'));
		}
		// Fallback for backward compatibility with old events that only have weekOf
		if (event.weekOf) {
			const weekStartDate = parseISO(event.weekOf + 'T00:00:00.000Z');
			return Array(7)
				.fill(0)
				.map((_, i) => addDays(weekStartDate, i));
		}
		return [];
	});

	const timeSlots = $state(
		Array(24 * (60 / timeInterval))
			.fill(0)
			.map((_, i) => {
				// Use local time instead of UTC to avoid timezone offset issues
				const localDate = new Date(1970, 0, 1, 0, 0, 0); // January 1, 1970, 00:00:00 local time
				const date = addMinutes(localDate, i * timeInterval);
				return format(date, 'h:mm a'); // Changed to 12-hour format with AM/PM
			})
	);

	// --- DERIVED STATE (Auto-recalculating values) ---

	// A quick lookup map for my selected slots for efficient rendering
	const mySelectionMap = $derived(() => {
		const map = new Map<string, boolean>();
		mySelections.forEach((slot) => {
			let current = parseISO(slot.start);
			const end = parseISO(slot.end);
			while (current < end) {
				map.set(current.toISOString(), true);
				current = addMinutes(current, timeInterval);
			}
		});
		return map;
	});

	// A map of all participants' slots for rendering team availability
	const allParticipantsMap = $derived(() => {
		const map = new Map<string, string[]>(); // Map<isoString, string[]>
		for (const name in event.participants) {
			if (name === participantName) continue; // Exclude current user
			event.participants[name].forEach((slot) => {
				let current = parseISO(slot.start);
				const end = parseISO(slot.end);
				while (current < end) {
					const iso = current.toISOString();
					const existing = map.get(iso) || [];
					map.set(iso, [...existing, name]);
					current = addMinutes(current, timeInterval);
				}
			});
		}
		return map;
	});

	// THE CORE LOGIC: Calculate mutual free time
	const mutualSlots = $derived(() => {
		const participantCount = Object.keys(event.participants).length;

		// If no participants, return empty array
		if (participantCount === 0) return [];

		// If only one participant, show their individual availability
		if (participantCount === 1) {
			const singleParticipant = Object.values(event.participants)[0];
			return singleParticipant || [];
		}

		// Calculate mutual availability for multiple participants
		const availabilityCounts = new Map<string, number>();
		for (const name in event.participants) {
			event.participants[name].forEach((slot) => {
				let current = parseISO(slot.start);
				const end = parseISO(slot.end);
				while (current < end) {
					const iso = current.toISOString();
					availabilityCounts.set(iso, (availabilityCounts.get(iso) || 0) + 1);
					current = addMinutes(current, timeInterval);
				}
			});
		}

		const mutualISOs = [...availabilityCounts.entries()]
			.filter(([, count]) => count === participantCount)
			.map(([iso]) => iso)
			.sort();

		// Group consecutive slots
		return groupConsecutiveSlots(mutualISOs, timeInterval);
	});

	// --- SIMPLIFIED SELECTION HANDLERS ---
	function handleClick(slotTime: Date) {
		toggleSlot(slotTime);
	}

	// Custom enhance function to handle form submission
	function handleFormEnhance() {
		return async ({ result }: { result: any }) => {
			if (result.type === 'success' && result.data?.event) {
				event = result.data.event;
				// Update my selections from the server response
				if (participantName) {
					mySelections = event.participants[participantName]
						? [...event.participants[participantName]]
						: [];
				}
			}
		};
	}

	// Initialize selections once when component loads
	$effect.pre(() => {
		if (participantName) {
			mySelections = event.participants[participantName]
				? [...event.participants[participantName]]
				: [];
		}
	});

	// Simple toggle function
	function toggleSlot(slotTime: Date) {
		const endOfSlot = addMinutes(slotTime, timeInterval);
		const newSlot: TimeSlot = { start: slotTime.toISOString(), end: endOfSlot.toISOString() };

		// Check if this slot is already selected
		const isAlreadySelected = mySelectionMap().get(newSlot.start);

		if (isAlreadySelected) {
			// Remove the slot if it's already selected
			mySelections = mySelections.filter((slot) => {
				const slotStart = parseISO(slot.start);
				const slotEnd = parseISO(slot.end);
				const newSlotStart = parseISO(newSlot.start);
				const newSlotEnd = parseISO(newSlot.end);

				// Remove if this slot overlaps with the clicked slot
				return !(slotStart < newSlotEnd && slotEnd > newSlotStart);
			});
		} else {
			// Add the slot if it's not selected
			mySelections.push(newSlot);
		}
	}

	// --- UTILITY ---
	// Helper to group individual 30-min slots into larger blocks
	function groupConsecutiveSlots(isoStrings: string[], interval: number): TimeSlot[] {
		if (isoStrings.length === 0) return [];
		const result: TimeSlot[] = [];
		let currentStart = parseISO(isoStrings[0]);

		for (let i = 1; i < isoStrings.length; i++) {
			const prev = parseISO(isoStrings[i - 1]);
			const current = parseISO(isoStrings[i]);
			if (current.getTime() - prev.getTime() > interval * 60 * 1000) {
				result.push({
					start: currentStart.toISOString(),
					end: addMinutes(prev, interval).toISOString()
				});
				currentStart = current;
			}
		}
		result.push({
			start: currentStart.toISOString(),
			end: addMinutes(parseISO(isoStrings[isoStrings.length - 1]), interval).toISOString()
		});
		return result;
	}
</script>

<div class="container mx-auto p-4 md:p-8" role="main">
	<div class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
		<div class="flex items-center gap-4">
			<div>
				<h1 class="text-3xl font-bold">Schedule for Event</h1>
				<p class="text-muted-foreground">
					Code: <Badge variant="secondary">{event.code}</Badge>
				</p>
				<p class="text-muted-foreground">
					Selected Dates: {selectedDates()
						.map((date) => format(date, 'MMM d, yyyy'))
						.join(', ')}
				</p>
			</div>
			{#if loggedInUser && userEvents.length > 0}
				<InviteCodeDropdown {userEvents} currentCode={event.code} />
			{/if}
		</div>
		{#if loggedInUser}
			<form
				method="POST"
				action="?/update"
				use:enhance={handleFormEnhance}
				class="w-full md:w-auto"
			>
				<input type="hidden" name="selections" value={JSON.stringify(mySelections)} />
				<input type="hidden" name="username" bind:value={participantName} />
				<Button type="submit" class="w-full" disabled={!participantName}
					>Save My Availability</Button
				>
			</form>
		{:else}
			<Button href="/login" class="w-full md:w-auto">Login to Save Availability</Button>
		{/if}
	</div>

	{#if !loggedInUser}
		<Alert.Root class="my-6">
			<Alert.Title>Authentication Required</Alert.Title>
			<Alert.Description>
				You need to be logged in to save your availability for this event. You can still view the
				event and see other participants' availability, but you won't be able to contribute your own
				times.
			</Alert.Description>
		</Alert.Root>
	{:else if !participantName}
		<Alert.Root class="my-6">
			<Alert.Title>Who are you?</Alert.Title>
			<Alert.Description>
				<Label for="username" class="mb-2 block">Enter your name to participate:</Label>
				<Input
					name="username-input"
					id="username"
					bind:value={participantName}
					placeholder="Your Name"
				/>
			</Alert.Description>
		</Alert.Root>
	{/if}

	<Separator class="my-6" />

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
		<!-- The Scheduler Grid -->
		<div class="rounded-lg border select-none lg:col-span-2" role="presentation">
			<div class="grid" style="grid-template-columns: auto repeat({selectedDates().length}, 1fr);">
				<!-- Time Column -->
				<div class="text-muted-foreground border-r p-2 text-center text-xs font-semibold">Time</div>
				<!-- Day Headers -->
				{#each selectedDates() as day}
					<div class="text-muted-foreground border-r p-2 text-center text-xs font-semibold">
						<div>{format(day, 'E')}</div>
						<div>{format(day, 'M/d')}</div>
					</div>
				{/each}

				<!-- Grid Body -->
				{#each timeSlots as time, i (time)}
					<!-- Time Column -->
					<div class="text-muted-foreground relative border-r p-2 text-center text-xs">
						{#if i % 2 === 0}
							<span class="absolute top-[-8px] right-1">{time}</span>
						{/if}
					</div>

					<!-- Slot Cells -->
					{#each selectedDates() as day, j (j)}
						{@const timeIndex = i}
						{@const hour = Math.floor((timeIndex * timeInterval) / 60)}
						{@const minute = (timeIndex * timeInterval) % 60}
						{@const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`}
						{@const slotDateTime = new Date(format(day, 'yyyy-MM-dd') + 'T' + timeString + ':00')}
						{@const iso = slotDateTime.toISOString()}
						{@const isMySelection = mySelectionMap().get(iso)}
						{@const otherSelections = allParticipantsMap().get(iso)}
						<div
							class="h-6 border-t border-r transition-colors duration-150 {isMySelection
								? 'bg-primary/80'
								: ''} {!isMySelection && otherSelections
								? 'bg-opacity-20 bg-blue-400'
								: ''} {loggedInUser && participantName
								? 'hover:bg-primary/30 cursor-pointer'
								: 'cursor-not-allowed opacity-60'}"
							onclick={loggedInUser && participantName
								? () => handleClick(slotDateTime)
								: undefined}
							onkeydown={loggedInUser && participantName
								? (e) => e.key === 'Enter' && handleClick(slotDateTime)
								: undefined}
							role={loggedInUser && participantName ? 'button' : 'presentation'}
							{...loggedInUser && participantName ? { tabindex: 0 } : {}}
							aria-label={loggedInUser && participantName
								? `Select time slot for ${format(day, 'EEEE')} at ${time}`
								: `Time slot for ${format(day, 'EEEE')} at ${time} (login required to select)`}
						>
							{#if !isMySelection && otherSelections}
								<div class="pointer-events-none h-full w-full opacity-30">
									<!-- A visual hint for others' selections -->
									{#each otherSelections as person (person)}
										<div class="h-1/4 bg-amber-500"></div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				{/each}
			</div>
		</div>

		<!-- Results Panel -->
		<div class="rounded-lg border p-4">
			<Tabs.Root value="mutual" class="w-full">
				<Tabs.List class="grid w-full grid-cols-3">
					<Tabs.Trigger value="mutual">Mutual</Tabs.Trigger>
					<Tabs.Trigger value="me">My Selections</Tabs.Trigger>
					<Tabs.Trigger value="team">Team</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="mutual" class="pt-4">
					<h3 class="font-semibold">Best Times to Meet</h3>
					<p class="text-muted-foreground text-sm">Times when everyone is available.</p>
					<div class="mt-4 space-y-2">
						{#if mutualSlots().length > 0}
							{#each mutualSlots() as slot}
								<div
									class="rounded-md bg-green-100 p-2 text-sm text-green-900 dark:bg-green-900/50 dark:text-green-200"
								>
									<strong>{format(parseISO(slot.start), 'EEE, MMM d')}</strong>:
									{format(parseISO(slot.start), 'h:mm a')} - {format(parseISO(slot.end), 'h:mm a')}
								</div>
							{/each}
						{:else}
							<p class="text-muted-foreground text-sm">
								No overlapping times found for all participants yet.
							</p>
						{/if}
					</div>
				</Tabs.Content>
				<Tabs.Content value="me" class="pt-4">
					<h3 class="font-semibold">My Availability</h3>
					{#if loggedInUser}
						<div class="mt-4 space-y-2">
							{#each mySelections as slot (slot.start)}
								<div class="bg-secondary rounded-md p-2 text-sm">
									<strong>{format(parseISO(slot.start), 'EEE, MMM d')}</strong>:
									{format(parseISO(slot.start), 'h:mm a')} - {format(parseISO(slot.end), 'h:mm a')}
								</div>
							{/each}
						</div>
					{:else}
						<div class="mt-4">
							<p class="text-muted-foreground text-sm">
								Please log in to view and manage your availability for this event.
							</p>
							<Button href="/login" class="mt-2" size="sm">Login</Button>
						</div>
					{/if}
				</Tabs.Content>
				<Tabs.Content value="team" class="pt-4">
					<h3 class="font-semibold">Team Availability</h3>
					<div class="mt-4 space-y-4">
						{#each Object.entries(event.participants) as [name, slots]}
							<div>
								<Badge>{name}</Badge>
								<div class="mt-2 space-y-1">
									{#each slots as slot (slot.start)}
										<div class="text-muted-foreground text-xs">
											<strong>{format(parseISO(slot.start), 'EEE')}</strong>:
											{format(parseISO(slot.start), 'h:mm')} - {format(
												parseISO(slot.end),
												'h:mm a'
											)}
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</Tabs.Content>
			</Tabs.Root>
		</div>
	</div>
</div>
