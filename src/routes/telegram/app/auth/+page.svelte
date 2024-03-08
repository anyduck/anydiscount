<script>
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";

	$: message = "Входимо...";

	onMount(async () => {
		const data = new URLSearchParams(location.hash.replace(/^#/, "")).get("tgWebAppData");
		if (data === null) {
			message = "Оточення не підтримується";
			// TODO: redirect to a standalone website
			return;
		}
		const response = await fetch("/auth/callback/telegram", {
			method: "POST",
			body: new URLSearchParams(data),
		});

		if (response.ok) {
			await goto(new URLSearchParams(location.search).get("return_to") ?? "/telegram/app");
		} else {
			message = "Не авторизовано";
		}
	});
</script>

<h1>{message}</h1>
