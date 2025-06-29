<script lang="ts">
	import { enhance } from '$app/forms';
	import { Toaster, toast } from 'svelte-sonner';

	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';

	let { form } = $props();

	// Show a toast message on success or failure from the server actions
	$effect(() => {
		if (form?.message) {
			if (form.success) {
				toast.success(form.message);
			} else {
				toast.error(form.message);
			}
		}
	});
</script>

<Toaster richColors />

<div class="container flex h-[80vh] items-center justify-center">
	<Tabs.Root value="login" class="w-[400px]">
		<Tabs.List class="grid w-full grid-cols-2">
			<Tabs.Trigger value="login">Login</Tabs.Trigger>
			<Tabs.Trigger value="signup">Sign Up</Tabs.Trigger>
		</Tabs.List>

		<!-- Login Form -->
		<Tabs.Content value="login">
			<Card.Root>
				<Card.Header>
					<Card.Title>Login</Card.Title>
					<Card.Description>Enter your credentials to access your account.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<form class="flex flex-col gap-4" method="POST" action="?/login" use:enhance>
						<div class="space-y-2">
							<Label for="username-login">Username</Label>
							<Input id="username-login" name="username" placeholder="your-username" required />
						</div>
						<div class="space-y-2">
							<Label for="password-login">Password</Label>
							<Input id="password-login" name="password" type="password" required />
						</div>
						<Button type="submit" class="w-full">Login</Button>
					</form>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<!-- Sign Up Form -->
		<Tabs.Content value="signup">
			<Card.Root>
				<Card.Header>
					<Card.Title>Sign Up</Card.Title>
					<Card.Description>Create a new account to get started.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<form class="flex flex-col gap-4" method="POST" action="?/signup" use:enhance>
						<div class="space-y-2">
							<Label for="username-signup">Username</Label>
							<Input
								id="username-signup"
								name="username"
								placeholder="choose-a-username"
								required
							/>
						</div>
						<div class="space-y-2">
							<Label for="password-signup">Password</Label>
							<Input id="password-signup" name="password" type="password" required />
						</div>
						<Button type="submit" class="w-full">Create Account</Button>
					</form>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>
