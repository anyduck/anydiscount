<script>
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { onMount } from "svelte";

	onMount(async () => {
		if ($page.status !== 500) return;
		if ($page.url.pathname.startsWith("/fora")) await goto("/fora/offline");
	});
</script>

<h1>{$page.status} {$page.error?.message}</h1>
