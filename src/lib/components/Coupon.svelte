<script context="module">
	const formatter = new Intl.DateTimeFormat("uk-UA", {
		day: "numeric",
		month: "long",
	});
</script>

<script>
	/** @type {string} */
	export let discount;
	/** @type {string} */
	export let minimumSpend;
	/** @type {Date} */
	export let expiredAt;
</script>

<div class="coupon">
	<div class="info">
		<div class="title">{discount} грн.</div>
		{#if minimumSpend}
			<div>Покупка понад {minimumSpend} грн.</div>
		{:else}
			<div>Немає мінімальної суми</div>
		{/if}
		<div>Дійсний до {formatter.format(expiredAt)}</div>
	</div>
	<div class="action"><slot /></div>
</div>

<style>
	.coupon {
		display: flex;
		filter: drop-shadow(0 0 1rem rgb(0 0 0 / 0.122));
	}
	.info,
	.action {
		margin-block: 0.5rem;
		border-radius: 0.5rem;
		padding: 0.5rem;
		background-color: var(--color-surface-section);
	}
	.info {
		flex-grow: 1;
		color: var(--color-hint);
	}
	.title {
		font-size: 2rem;
		color: var(--color-text);
	}
	.action {
		border-left: var(--color-surface-ground) dashed 2px;
		min-width: 30%;
		display: flex;
		justify-content: center;
		align-items: center;
	}
</style>
