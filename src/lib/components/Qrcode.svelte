<script>
	import QrCode from "qrjs";

	/** @type {string} */
	export let text;
	export let margin = 4;

	$: [size, path] = generateSVGPath(text);

	/**
	 * Generates QR code SVG path data from numeric string
	 * @param {string} numeric
	 * @returns {[size: number, path: string]}
	 */
	function generateSVGPath(numeric) {
		if (/[^\d]/.test(numeric) || numeric.length > 7_089) {
			return [1, ""];
		}
		const matrix = QrCode.generate(numeric, { ecclevel: "L", mode: "numeric" });
		let path = "";
		for (let y = 0; y < matrix.length; y++) {
			for (let x = 0; x < matrix.length; x++) {
				if (matrix[y][x]) {
					path += `M${margin + x},${margin + y + 0.5}h1`;
				}
			}
		}
		return [matrix.length + 2 * margin, path];
	}
</script>

<svg viewBox="0 0 {size} {size}" version="1.1" xmlns="http://www.w3.org/2000/svg">
	<rect fill="white" width="100%" height="100%" />
	<path stroke="black" stroke-width="1" shape-rendering="crispEdges" d={path} />
</svg>
