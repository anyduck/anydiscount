<script>
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import google from "$lib/assets/google.svg?raw";
	import { onMount } from "svelte";

	onMount(async () => {
		if ($page.status !== 500) return;
		if ($page.url.pathname.startsWith("/fora")) await goto("/fora/offline");
	});
</script>

<h1>{$page.status} {$page.error?.message}</h1>
{#if $page.status === 401}
	<ul>
		<li><a href="/auth/google">{@html google}Продовжити з Google</a></li>
	</ul>
{/if}

<style>
	h1 {
		padding: 1rem;
	}
	ul {
		margin-inline: auto;
		max-width: 480px;
		list-style-type: none;
		padding-inline: 1rem;
	}
	a {
		display: block;
		text-decoration: none;
		background-color: var(--color-surface-section);
		color: var(--color-text);
		border: 1px rgba(0, 0, 0, 0.122) solid;
		border-radius: 2rem;
		padding: 0.75rem;
		font-size: 1rem;
		line-height: 1rem;

		text-align: center;
		position: relative;
		& svg {
			position: absolute;
			left: 0.5rem;
			top: 0.5rem;
		}
	}
</style>
