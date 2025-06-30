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

	// Helper to find all intervals with the max number of participants, merging consecutive ones
	function findMaxMutualIntervals(
		participants: Record<string, TimeSlot[]>
	): { start: string; end: string; users: string[] }[] {
		// 1. Collect all unique boundaries
		const boundaries = new Set<string>();
		for (const slots of Object.values(participants)) {
			for (const slot of slots) {
				boundaries.add(slot.start);
				boundaries.add(slot.end);
			}
		}
		const sorted = Array.from(boundaries).sort();

		// 2. Build intervals between boundaries
		const intervals: { start: string; end: string; users: string[] }[] = [];
		for (let i = 0; i < sorted.length - 1; i++) {
			const start = sorted[i];
			const end = sorted[i + 1];
			// 3. Find which users are available in this interval
			const users: string[] = [];
			for (const [name, slots] of Object.entries(participants)) {
				if (slots.some((slot: TimeSlot) => slot.start <= start && slot.end >= end)) {
					users.push(name);
				}
			}
			intervals.push({ start, end, users });
		}

		// 4. Find max count
		const maxCount = Math.max(...intervals.map((i) => i.users.length), 0);

		// 5. Merge consecutive intervals with max count and same users
		const result: { start: string; end: string; users: string[] }[] = [];
		let current: { start: string; end: string; users: string[] } | null = null;
		for (const interval of intervals) {
			if (interval.users.length === maxCount && maxCount > 0) {
				if (
					current &&
					current.end === interval.start &&
					JSON.stringify([...current.users].sort()) === JSON.stringify([...interval.users].sort())
				) {
					current.end = interval.end;
				} else {
					if (current) result.push(current);
					current = { start: interval.start, end: interval.end, users: [...interval.users] };
				}
			} else {
				if (current) {
					result.push(current);
					current = null;
				}
			}
		}
		if (current) result.push(current);

		return result;
	}

	// THE CORE LOGIC: Calculate best possible meeting times (mutual slots)
	const mutualSlots = $derived(() => {
		const participantCount = Object.keys(event.participants).length;
		if (participantCount === 0) return [];
		if (participantCount === 1) {
			const singleParticipant = Object.values(event.participants)[0];
			return (singleParticipant || []).map((slot) => ({
				...slot,
				users: [Object.keys(event.participants)[0]]
			}));
		}
		return findMaxMutualIntervals(event.participants);
	});

	// Calculate the maximum number of participants available for the best times
	const maxParticipantsForBestTimes = $derived(() => {
		if (!mutualSlots() || mutualSlots().length === 0) {
			return 0;
		}
		// All slots in mutualSlots have the same number of users.
		return mutualSlots()[0].users.length;
	});

	// --- SIMPLIFIED SELECTION HANDLERS ---
	function handleClick(slotTime: Date) {
		toggleSlot(slotTime);
	}

	// Add keyboard navigation support
	function handleKeydown(event: KeyboardEvent, slotTime: Date) {
		if (!loggedInUser || !participantName) return;

		switch (event.key) {
			case 'Enter':
			case ' ':
				event.preventDefault();
				toggleSlot(slotTime);
				break;
			case 'ArrowUp':
			case 'ArrowDown':
			case 'ArrowLeft':
			case 'ArrowRight':
				event.preventDefault();
				navigateToAdjacentSlot(event.key, slotTime);
				break;
		}
	}

	// Navigate to adjacent slot for keyboard navigation
	function navigateToAdjacentSlot(direction: string, currentSlot: Date) {
		const currentIndex = selectedDates().findIndex(
			(date) => format(date, 'yyyy-MM-dd') === format(currentSlot, 'yyyy-MM-dd')
		);
		const timeIndex = timeSlots.findIndex((time) => {
			const hour = Math.floor((timeSlots.indexOf(time) * timeInterval) / 60);
			const minute = (timeSlots.indexOf(time) * timeInterval) % 60;
			const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
			return timeString === format(currentSlot, 'HH:mm');
		});

		// Handle edge cases
		if (currentIndex === -1 || timeIndex === -1) return;

		let newDateIndex = currentIndex;
		let newTimeIndex = timeIndex;

		switch (direction) {
			case 'ArrowUp':
				newTimeIndex = Math.max(0, timeIndex - 1);
				break;
			case 'ArrowDown':
				newTimeIndex = Math.min(timeSlots.length - 1, timeIndex + 1);
				break;
			case 'ArrowLeft':
				newDateIndex = Math.max(0, currentIndex - 1);
				break;
			case 'ArrowRight':
				newDateIndex = Math.min(selectedDates().length - 1, currentIndex + 1);
				break;
		}

		if (newDateIndex !== currentIndex || newTimeIndex !== timeIndex) {
			const newDate = selectedDates()[newDateIndex];
			const hour = Math.floor((newTimeIndex * timeInterval) / 60);
			const minute = (newTimeIndex * timeInterval) % 60;
			const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
			const newSlotDateTime = new Date(format(newDate, 'yyyy-MM-dd') + 'T' + timeString + ':00');

			// Focus the new slot with a small delay to ensure DOM is updated
			setTimeout(() => {
				const newSlotElement = document.querySelector(
					`[data-slot-id="${newSlotDateTime.toISOString()}"]`
				) as HTMLElement;
				if (newSlotElement) {
					newSlotElement.focus();
				}
			}, 10);
		}
	}

	// Add visual feedback for selection
	function handleSlotInteraction(slotTime: Date, event: MouseEvent | KeyboardEvent) {
		// Add a brief visual feedback
		const slotElement = event.target as HTMLElement;
		if (slotElement) {
			// Add ripple effect for mouse clicks
			if (event instanceof MouseEvent) {
				const ripple = document.createElement('div');
				ripple.className =
					'absolute inset-0 bg-white/20 rounded-sm animate-ping pointer-events-none';
				ripple.style.animationDuration = '300ms';
				slotElement.appendChild(ripple);

				setTimeout(() => {
					ripple.remove();
				}, 300);
			}

			// Add scale animation
			slotElement.classList.add('scale-95');
			setTimeout(() => {
				slotElement.classList.remove('scale-95');
			}, 150);
		}

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

						<!-- Hidden checkbox for proper semantics -->
						{#if loggedInUser && participantName}
							<input
								type="checkbox"
								class="sr-only"
								checked={isMySelection}
								onchange={() => toggleSlot(slotDateTime)}
								aria-label={`Select time slot for ${format(day, 'EEEE')} at ${time}`}
							/>
						{/if}

						<div
							class="relative h-6 transform border-t border-r transition-all duration-200 ease-in-out
								{isMySelection
								? 'bg-primary/90 border-primary/30 scale-[0.98] shadow-sm'
								: 'bg-background hover:bg-accent/50 border-border hover:scale-[1.02]'} 
								{!isMySelection && otherSelections ? 'bg-blue-100/50 dark:bg-blue-900/20' : ''} 
								{loggedInUser && participantName
								? 'focus:ring-primary/50 cursor-pointer focus:ring-2 focus:ring-offset-1 focus:outline-none active:scale-95'
								: 'cursor-not-allowed opacity-60'}"
							onclick={loggedInUser && participantName
								? (event) => handleSlotInteraction(slotDateTime, event)
								: undefined}
							onkeydown={loggedInUser && participantName
								? (e) => handleKeydown(e, slotDateTime)
								: undefined}
							role={loggedInUser && participantName ? 'checkbox' : 'presentation'}
							aria-checked={loggedInUser && participantName ? isMySelection : undefined}
							{...loggedInUser && participantName ? { tabindex: 0 } : {}}
							data-slot-id={iso}
							aria-label={loggedInUser && participantName
								? `Select time slot for ${format(day, 'EEEE')} at ${time}`
								: `Time slot for ${format(day, 'EEEE')} at ${time} (login required to select)`}
						>
							<!-- Checkbox indicator -->
							{#if isMySelection}
								<div
									class="animate-in fade-in-0 zoom-in-50 absolute inset-0 flex items-center justify-center duration-200"
								>
									<svg
										class="text-primary-foreground h-3 w-3 drop-shadow-sm"
										fill="currentColor"
										viewBox="0 0 20 20"
										aria-hidden="true"
									>
										<path
											fill-rule="evenodd"
											d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
											clip-rule="evenodd"
										/>
									</svg>
								</div>
							{/if}

							<!-- Hover indicator -->
							{#if loggedInUser && participantName && !isMySelection}
								<div
									class="absolute inset-0 opacity-0 transition-opacity duration-150 hover:opacity-100"
								>
									<div
										class="bg-primary/20 flex h-full w-full items-center justify-center rounded-sm"
									>
										<svg
											class="text-primary/60 h-2.5 w-2.5"
											fill="currentColor"
											viewBox="0 0 20 20"
											aria-hidden="true"
										>
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
								</div>
							{/if}

							<!-- Others' selections indicator -->
							{#if !isMySelection && otherSelections}
								<div class="pointer-events-none absolute inset-0 opacity-30">
									{#each otherSelections as person (person)}
										<div class="mx-0.5 h-1/4 rounded-sm bg-amber-500/60"></div>
									{/each}
								</div>
							{/if}

							<!-- Focus ring for keyboard navigation -->
							{#if loggedInUser && participantName}
								<div
									class="focus-within:ring-primary/50 absolute inset-0 ring-2 ring-transparent transition-all duration-150 focus-within:ring-offset-1"
								></div>
							{/if}

							<!-- Selection border indicator -->
							{#if isMySelection}
								<div
									class="border-primary/40 pointer-events-none absolute inset-0 rounded-sm border-2"
								></div>
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
					<p class="text-muted-foreground text-sm">
						{#if maxParticipantsForBestTimes() > 0}
							Times that work for {maxParticipantsForBestTimes()} out of {Object.keys(
								event.participants
							).length} participants.
						{:else}
							Times that work for the most participants.
						{/if}
					</p>
					<div class="mt-4 space-y-2">
						{#if mutualSlots().length > 0}
							{#each mutualSlots() as slot}
								<details class="group rounded-md bg-green-100 dark:bg-green-900/50">
									<summary
										class="flex cursor-pointer list-none items-center justify-between p-2 text-sm text-green-900 transition-colors hover:bg-green-200/50 dark:text-green-200 dark:hover:bg-green-900"
									>
										<div>
											<strong>{format(parseISO(slot.start), 'EEE, MMM d')}</strong>:
											{format(parseISO(slot.start), 'h:mm a')} -
											{format(parseISO(slot.end), 'h:mm a')}
											{#if slot.users.length > 0}
												<span class="text-xs opacity-75"> ({slot.users.length} participants)</span>
											{/if}
										</div>
										<span class="transform transition-transform duration-200 group-open:rotate-90">
											<svg
												class="h-4 w-4"
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 20 20"
												fill="currentColor"
											>
												<path
													fill-rule="evenodd"
													d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
													clip-rule="evenodd"
												/>
											</svg>
										</span>
									</summary>
									<div class="border-t border-green-200/50 p-3 dark:border-green-800/60">
										<ul class="list-disc space-y-1 pl-5 text-xs text-green-800 dark:text-green-300">
											{#each slot.users as user}
												<li>{user}</li>
											{/each}
										</ul>
									</div>
								</details>
							{/each}
						{:else}
							<p class="text-muted-foreground text-sm">
								No overlapping times found yet. Add your availability to see the best options.
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
