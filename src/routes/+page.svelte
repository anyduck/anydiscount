<script>
	import next from "$lib/assets/next.svg?raw";
	import { onMount } from "svelte";

	// FIXME: find a better way to remove cold start delays
	onMount(() => fetch("/fora/coupons?wakeup").catch(() => {}));

	const pluralRules = new Intl.PluralRules("ukr");

	/** @param {number} count */
	function getPluralCount(count) {
		switch (pluralRules.select(count)) {
			case "one":
				return `${count} купон`;
			case "few":
				return `${count} купони`;
			case "many":
				return `${count} купонів`;
			default:
				return count.toString();
		}
	}
</script>

<menu data-sveltekit-preload-data="">
	<li style="--color-accent: orange">
		<a href="/fora/coupons" data-watermark="Сільпо">
			{getPluralCount(0)} <span class="icon">{@html next}</span>
		</a>
	</li>
	<li style="--color-accent: var(--color-lime-500)">
		<a href="/fora/coupons" data-watermark="Фора">
			{getPluralCount(99)} <span class="icon">{@html next}</span>
		</a>
	</li>
</menu>

<style>
	menu {
		max-width: 480px;
		margin-inline: auto;
		padding-inline: 1rem;
		margin-top: 5rem;
		list-style: none;
		position: relative;
	}
	menu a {
		display: block;
		text-align: right;
		font-weight: 900;
		font-size: 2rem;
		color: var(--color-text);
		text-transform: capitalize;
		text-decoration: none;
		line-height: 6rem;
	}
	menu .icon {
		vertical-align: middle;
		filter: drop-shadow(0 0 1.5rem var(--color-accent));
	}
	menu a::after {
		content: attr(data-watermark);
		text-transform: uppercase;
		font-weight: 900;
		font-size: 6rem;
		color: var(--color-surface-ground);
		text-shadow:
			+1px +1px 0 var(--color-accent),
			-1px -1px 0 var(--color-accent),
			+1px -1px 0 var(--color-accent),
			-1px +1px 0 var(--color-accent),
			+1px +1px 0 var(--color-accent);

		position: absolute;
		left: 0;
		z-index: -1;
	}
</style>
