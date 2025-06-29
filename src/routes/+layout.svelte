<script lang="ts">
	import '../app.css';
	import { ModeWatcher, toggleMode } from 'mode-watcher';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { browser } from '$app/environment';
	import InviteCodeDropdown from '$lib/components/InviteCodeDropdown.svelte';
	import { cn } from '$lib/utils.js';

	let { children, data } = $props();
</script>

<ModeWatcher />

<div class="bg-background text-foreground min-h-screen font-sans antialiased">
	<header
		class="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 w-full border-b backdrop-blur-sm"
	>
		<div class="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
			<div class="flex gap-6 md:gap-10">
				<a href="/" class="flex items-center space-x-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="lucide lucide-calendar-check"
						><path d="M8 2v4" /><path d="M16 2v4" /><path
							d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"
						/><path d="M3 10h18" /><path d="m16 20 2 2 4-4" /></svg
					>
					<span class="inline-block font-bold">MutualTime</span>
				</a>
				{#if data.user && (data as any).userEvents && (data as any).userEvents.length > 0}
					<InviteCodeDropdown
						userEvents={(data as any).userEvents}
						currentCode={(data as any).currentEventCode || ''}
					/>
				{/if}
			</div>

			<div class="flex flex-1 items-center justify-end space-x-4">
				<nav class="flex items-center space-x-2">
					{#if browser}
						<Button
							onclick={toggleMode}
							class="hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 inline-flex size-9 shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
						>
							<Sun
								class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
							/>
							<Moon
								class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
							/>
							<span class="sr-only">Toggle theme</span>
						</Button>
					{/if}

					<!-- USER AUTH SECTION -->
					{#if data.user}
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								<div class={cn(buttonVariants({ variant: 'secondary' }), 'flex items-center')}>
									{data.user.username}
									<svg class="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 9l-7 7-7-7"
										></path></svg
									>
								</div>
							</DropdownMenu.Trigger>
							<DropdownMenu.Content>
								<DropdownMenu.Label>My Account</DropdownMenu.Label>
								<DropdownMenu.Separator />
								<!-- The form directly handles the logout action -->
								<form action="/logout" method="POST">
									<DropdownMenu.Item>
										<Button
											type="submit"
											variant="ghost"
											class="w-full cursor-pointer justify-start font-normal">Logout</Button
										>
									</DropdownMenu.Item>
								</form>
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					{:else}
						<Button href="/login">Login</Button>
					{/if}
				</nav>
			</div>
		</div>
	</header>

	<main>
		{@render children?.()}
	</main>
</div>
