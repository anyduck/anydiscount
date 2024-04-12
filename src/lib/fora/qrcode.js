import { encode } from "@msgpack/msgpack";

const VERSION = 1;

/**
 * Creates a string for using as text in a QR code
 * @param {number} posId
 * @param {string} posPEM
 * @param {Uint8Array} payload
 * @return {Promise<string>}
 */
export async function encryptLoyaltyData(posId, posPEM, payload) {
	const algorithm = { name: "ECDH", namedCurve: "P-256" };
	const posKey = await crypto.subtle.importKey("spki", pem2bytes(posPEM), algorithm, true, []);
	const pair = await crypto.subtle.generateKey(algorithm, true, ["deriveBits"]);
	const sharedKey = await deriveSharedKey(posKey, pair.privateKey);

	const point = await compressPoint(pair.publicKey);
	const { tag, encrypted } = await encryptData(sharedKey, payload);

	const len = 1 + point.length + tag.length + encrypted.length;
	const arr = new Uint8Array([VERSION, len >> 8, len & 255, posId, ...point, ...tag, ...encrypted]);

	return "5410" + BigInt("0x" + bytes2hex(arr)).toString(10);
}

/**
 * @typedef {Awaited<ReturnType<import("$lib/server/fora").getPersonalInfo>>["personalInfo"]} PersonalInfo
 */

/**
 * Encodes Fora account loyalty data
 * @param {0 | 1} electronicCheque
 * @param {string} guid
 * @param {PersonalInfo["Coupons"]} coupons
 * @returns {Uint8Array}
 */
export function encodeLoyaltyData(electronicCheque, guid, coupons) {
	// Encode active coupons as a list of 32bit integers
	const activeCoupons = new Array();
	for (const group of coupons) {
		for (const c of group.activCoupons) {
			if (c.isOff === 0 && c.useWayId === 2 && c.isCouponControl == 1) {
				activeCoupons.push(c.businessCouponId);
			}
		}
	}
	const encodedCoupons = activeCoupons.length ? activeCoupons : undefined;

	// Encode UUID as a list of 32bit integers
	const hex = guid.replaceAll("-", "");
	const encodedGUID = new Array(4);
	for (let i = 0; i < encodedGUID.length; i++) {
		encodedGUID[i] = parseInt(hex.slice(8 * i, 8 * (i + 1)), 16);
	}

	return encode(
		{
			c: encodedCoupons,
			b: electronicCheque,
			g: encodedGUID,
			t: Math.floor(Date.now() / 1000),
		},
		{ ignoreUndefined: true },
	);
}

/**
 * ECDH key agreement with custom KDF
 * @param {CryptoKey} publicKey
 * @param {CryptoKey} privateKey
 * @returns {Promise<CryptoKey>}
 */
async function deriveSharedKey(publicKey, privateKey) {
	const shr = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);

	// NOTICE: Their KDF looks like the one described in Section 4 of NIST.800-56C
	// https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Cr1.pdf
	const pre = new Uint8Array([0, 0, 0, 1, ...new Uint8Array(shr)]);
	const raw = await crypto.subtle.digest({ name: "SHA-256" }, pre);

	const algorithm = { name: "AES-GCM", length: 128 };
	return await crypto.subtle.importKey("raw", raw, algorithm, false, ["encrypt"]);
}

/**
 * AES-GSM encryption with separate tag and data buffers
 * @param {CryptoKey} key
 * @param {Uint8Array} data
 * @returns
 */
async function encryptData(key, data) {
	const iv = new Uint8Array(12);
	const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);

	return {
		tag: new Uint8Array(encrypted.slice(encrypted.byteLength - 16)),
		encrypted: new Uint8Array(encrypted.slice(0, encrypted.byteLength - 16)),
	};
}

/**
 * Custom way to encode public key for Elliptic Curve Cryptography
 * @param {CryptoKey} publicKey
 * @returns {Promise<Uint8Array>}
 */
async function compressPoint(publicKey) {
	const HEADER = 27;
	const buff = await crypto.subtle.exportKey("spki", publicKey);
	const data = new Uint8Array(buff);

	// NOTICE: This compression isn't standart, see Appendix D.2 of NIST.800-186
	// https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-186.pdf
	data[HEADER - 1] = data[HEADER + 32] > 0 ? 2 : 3;

	return data.subarray(HEADER - 1, HEADER + 32);
}

/**
 * Fastest Uint8Array to hex encoding
 * @param {Uint8Array} bytes
 * @return {string}
 */
function bytes2hex(bytes) {
	return bytes.reduce((hex, byte) => hex + (byte & 0xff).toString(16).padStart(2, "0"), "");
}

/**
 * Reads raw bytes from PEM encoded key
 * @param {string} PEM
 * @returns {Uint8Array}
 */
function pem2bytes(PEM) {
	const str = atob(
		PEM.replace("-----BEGIN PUBLIC KEY-----", "")
			.replace("-----END PUBLIC KEY-----", "")
			.replaceAll(/[\r\n]/g, ""),
	);
	const bytes = new Uint8Array(str.length);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = str.charCodeAt(i);
	}
	return bytes;
}
