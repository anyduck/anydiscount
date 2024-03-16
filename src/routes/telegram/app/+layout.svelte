<svelte:head>
	<script src="https://telegram.org/js/telegram-web-app.js"></script>
	<script>
		window.Telegram.WebApp.setHeaderColor("#f1f1f1");
	</script>
</svelte:head>

<main>
	<slot />
</main>

<style>
	main {
		max-width: 384px;
		margin-inline: auto;
		padding: 1rem;
	}
</style>
