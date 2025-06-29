<script lang="ts">
	import { goto } from '$app/navigation';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { ChevronDown, Calendar } from '@lucide/svelte/icons';
	import { cn } from '$lib/utils.js';
	import type { UserEvent } from '$lib/server/database';

	let { userEvents, currentCode } = $props<{
		userEvents: UserEvent[];
		currentCode: string;
	}>();

	function navigateToEvent(eventCode: string) {
		goto(`/event/${eventCode}`);
	}
</script>

{#if userEvents.length > 0}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			<div class={cn(buttonVariants({ variant: 'outline' }), 'flex items-center gap-2')}>
				<Calendar class="h-4 w-4" />
				<span>My Events</span>
				<ChevronDown class="h-4 w-4" />
			</div>
		</DropdownMenu.Trigger>
		<DropdownMenu.Content>
			<DropdownMenu.Label>Switch to Event</DropdownMenu.Label>
			<DropdownMenu.Separator />
			{#each userEvents as userEvent}
				<DropdownMenu.Item
					onclick={() => navigateToEvent(userEvent.eventCode)}
					class="cursor-pointer {userEvent.eventCode === currentCode ? 'bg-accent' : ''}"
				>
					<div class="flex items-center gap-2">
						<Calendar class="h-4 w-4" />
						<span>{userEvent.eventCode}</span>
						{#if userEvent.eventCode === currentCode}
							<span class="text-muted-foreground text-xs">(current)</span>
						{/if}
					</div>
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}
