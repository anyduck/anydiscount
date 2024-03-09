<script>
	/** @type {string} */
	export let ean_13;

	const EDGE = [1, 1, 1]; // 101
	const MIDDLE = [1, 1, 1, 1, 1]; // 01010
	const DIGIT2LINE = [
		[3, 2, 1, 1], // 0001101
		[2, 2, 2, 1], // 0011001
		[2, 1, 2, 2], // 0010011
		[1, 4, 1, 1], // 0111101
		[1, 1, 3, 2], // 0100011
		[1, 2, 3, 1], // 0110001
		[1, 1, 1, 4], // 0101111
		[1, 3, 1, 2], // 0111011
		[1, 2, 1, 3], // 0110111
		[3, 1, 1, 2], // 0001011
	];

	/**
	 * Parses the UPC-A barcode, which is a subset of the EAN-13 standard
	 * @param {string} ean_13 string of 13 numeric characters
	 * @returns {number[]} array of 12 digits
	 */
	function parseUPC_A(ean_13) {
		// https://en.wikipedia.org/wiki/International_Article_Number
		if (ean_13.length !== 13 || isNaN(Number(ean_13))) {
			throw new Error("Unexpected symbols in the barcode");
		}
		if (!ean_13.startsWith("0")) {
			throw new Error("This barcode isn't UPC-A compatible");
		}

		// https://en.wikipedia.org/wiki/Universal_Product_Code
		const upc_a = Array.from(ean_13.slice(1), (c) => Number(c));

		let checksum = 0;
		for (let i = 0; i < upc_a.length - 1; i++) {
			checksum += upc_a[i] * (3 - 2 * (i % 2));
		}
		checksum = (10 - (checksum % 10)) % 10;

		if (upc_a.at(-1) !== checksum) {
			throw new Error("This barcode has wrong checksum");
		}
		return upc_a;
	}

	/**
	 * Builds a representation of the UPC-A barcode
	 * @param {number[]} upc_a array of 12 digits
	 * @returns {number[]} array of barcode strip lengths
	 */
	function build_line(upc_a) {
		// 1 edge + 6 digits + 1 middle + 6 digits + 1 edge
		const line_length = 2 * EDGE.length + MIDDLE.length + 12 * DIGIT2LINE[0].length;
		/** @type {number[]} */
		const line = new Array(line_length).fill(1);
		for (let i = 0; i < 6; i++) {
			line.splice(3 + 4 * i, 4, ...DIGIT2LINE[upc_a[i]]);
		}
		for (let i = 6; i < 12; i++) {
			line.splice(3 + 5 + 4 * i, 4, ...DIGIT2LINE[upc_a[i]]);
		}
		return line;
	}

	/** @typedef {readonly [x: number, width: number]} Rect */

	/**
	 * Converts an array of barcode strip lengths into SVG elements
	 * @param {number[]} line array of barcode strip lengths
	 * @returns {Rect[]} array of rects for building SVG
	 */
	function line2rects(line) {
		/** @type {Rect[]} */
		const bars = new Array(Math.floor(line.length / 2));
		let count = 0;
		for (let i = 0; i < line.length; i++) {
			if (i % 2 === 0) {
				bars[i / 2] = [count, line[i]];
			}
			count += line[i];
		}
		if (count !== 95) {
			throw new Error("Couldn't convert a barcode to svg");
		}
		return bars;
	}
</script>

<svg fill="black" viewBox="0 0 55 95" version="1.1" xmlns="http://www.w3.org/2000/svg">
	<rect fill="white" width="100%" height="95" />
	{#each line2rects(build_line(parseUPC_A(ean_13))) as [y, height]}
		<rect {y} width="100%" {height} />
	{/each}
</svg>
