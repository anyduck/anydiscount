<script>
	/** @type {string} */
	export let ean13;

	const QUIET = 9;

	// run-length encoded	LLLLLLL	GGGGGGG	RRRRRRR
	const DIGIT = [
		[3, 2, 1, 1], // 0	0001101	0100111	1110010
		[2, 2, 2, 1], // 1	0011001	0110011	1100110
		[2, 1, 2, 2], // 2	0010011	0011011	1101100
		[1, 4, 1, 1], // 3	0111101	0100001	1000010
		[1, 1, 3, 2], // 4	0100011	0011101	1011100
		[1, 2, 3, 1], // 5	0110001	0111001	1001110
		[1, 1, 1, 4], // 6	0101111	0000101	1010000
		[1, 3, 1, 2], // 7	0111011	0010001	1000100
		[1, 2, 1, 3], // 8	0110111	0001001	1001000
		[3, 1, 1, 2], // 9	0001011	0010111	1110100
	];

	const FIRST = /** @type {const} */ ([
		["L", "L", "L", "L", "L", "L"],
		["L", "L", "G", "L", "G", "G"],
		["L", "L", "G", "G", "L", "G"],
		["L", "L", "G", "G", "G", "L"],
		["L", "G", "L", "L", "G", "G"],
		["L", "G", "G", "L", "L", "G"],
		["L", "G", "G", "G", "L", "L"],
		["L", "G", "L", "G", "L", "G"],
		["L", "G", "L", "G", "G", "L"],
		["L", "G", "G", "L", "G", "L"],
	]);

	const CODES = { L: DIGIT, G: DIGIT.map((d) => d.toReversed()), R: DIGIT };

	/**
	 * Parses the EAN-13 barcode after removing non numeric chars
	 * https://en.wikipedia.org/wiki/International_Article_Number
	 * @param {string} ean13
	 * @returns {Uint8Array}
	 */
	function parseEAN13(ean13) {
		const string = ean13.replace(/\D+/g, "");
		if (string.length !== 13) {
			throw new Error("Barcode with wrong length");
		}
		const array = Uint8Array.from(string, (c) => Number(c));

		let checksum = 0;
		for (let i = 0; i < array.length - 1; i++) {
			checksum += array[i] * (1 + 2 * (i % 2));
		}
		checksum = (10 - (checksum % 10)) % 10;

		if (array.at(-1) !== checksum) {
			throw new Error("Barcode with wrong checksum");
		}
		return array;
	}

	/**
	 * Builds a representation of the barcode
	 * @param {Uint8Array} ean13
	 * @returns {Uint8Array} strip lengths
	 */
	function lineEAN13(ean13) {
		// EDGE + 6 * DIGIT + MIDDLE + 6 * DIGIT + EDGE
		const line = new Uint8Array(2 * 3 + 5 + 12 * 4).fill(1);
		for (let i = 0; i < 6; i++) {
			const codesLGR = FIRST[ean13[0]][i];
			line.set(CODES[codesLGR][ean13[i + 1]], 4 * i + 3);
			line.set(CODES["R"][ean13[i + 7]], 4 * i + 8 + 24);
		}
		return line;
	}

	/**
	 * Converts strip lengths into SVG rects
	 * @param {Uint8Array} line strip lengths
	 * @returns {[x: number, width: number][]}
	 */
	function line2rects(line) {
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

<svg viewBox="0 0 55 {95 + 2 * QUIET}" version="1.1" xmlns="http://www.w3.org/2000/svg">
	<rect fill="white" width="100%" height="100%" />
	{#each line2rects(lineEAN13(parseEAN13(ean13))) as [y, height]}
		<rect y={y + QUIET} width="100%" {height} />
	{/each}
</svg>
