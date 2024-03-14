import { z } from "zod";

const APP_VERSION_CODE = "195";
const APP_VERSION_NAME = "1.39.4";
const APP_API_URL = "https://api.mob.fora.ua/api/2.0/exec/FZGlobal/";

const BASE_RESPONSE = z.object({
	error: z.object({
		errorCode: z.number(),
		errorString: z.string(),
	}),
});

export class Account {
	/**
	 * @param {string} accessToken
	 * @param {string} refreshToken
	 * @param {Device} device
	 */
	constructor(accessToken, refreshToken, device) {
		this.accessToken = accessToken;
		this.refreshToken = refreshToken;
		this.userInfo = getUserInfo(device);
	}

	isAccessTokenExpired() {
		/** @type {unknown} */
		const payload = JSON.parse(atob(this.accessToken.split(".", 3)[1]));
		if (payload && typeof payload === "object" && "exp" in payload) {
			if (payload.exp && typeof payload.exp === "number") {
				return payload.exp * 1000 < Date.now() + 60_000;
			}
		}
		return true;
	}
}

/**
 * @param {Account} account
 * @param {boolean} forceUpdate
 */
export async function getPersonalInfo(account, forceUpdate) {
	const coupon = z.object({
		isOff: z.number(),
		isCouponControl: z.number(),
		listImages: z.array(z.string().url()),
		limitText: z.string(),
		businessCouponId: z.number(),
		useWayId: z.number(),
		endDate: z.string(),
		rewardText: z.string(),
		couponDescription: z.string(),
	});
	const response = BASE_RESPONSE.extend({
		personalInfo: z.object({
			Bonus: z.object({ bonusBalanceAmount: z.number() }),
			Coupons: z.array(z.object({ activCoupons: z.array(coupon) })),
		}),
	});

	/** @type {Body} */
	const body = { Method: "GetPersonalInfo_V6", Data: { forceUpdate } };
	const resp = await request(body, account.userInfo, account.accessToken);
	return response.parse(await resp.json());
}

/**
 * @param {Account} account
 */
export async function refreshToken(account) {
	const token = z.object({
		value: z.string(),
		expireat: z.number(),
	});
	const response = BASE_RESPONSE.extend({
		tokens: z.object({
			accessToken: token,
			refreshToken: token,
		}),
	});

	/** @type {Body} */
	const body = { Data: {}, Method: "RefreshToken" };
	const resp = await request(body, account.userInfo, account.refreshToken);
	return response.parse(await resp.json());
}

/**
 * @param {Account} account
 */
export async function getLastChequeHeadersFast(account) {
	const header = z.object({
		filId: z.number(),
		chequeId: z.number(),
		created: z.string(),
		loyaltyFactId: z.number(),
		sumReg: z.number(),
		sumBalance: z.number(),
		identificationString: z.string(),
		fiscalNumber: z.string().nullable(),
	});
	const response = BASE_RESPONSE.extend({
		sumBalance: z.array(
			z.object({
				year: z.number(),
				month: z.number(),
				sumBalance: z.number(),
				headers: z.array(header),
			}),
		),
	});

	/** @type {Body} */
	const body = { Method: "GetLastChequeHeadersFast", Data: {} };
	const resp = await request(body, account.userInfo, account.accessToken);
	return response.parse(await resp.json());
}

/**
 * @param {Account} account
 * @param {import("zod").infer<data>["identities"]} identities
 */
export async function getChequesInfos(account, identities) {
	const data = z.object({
		identities: z.array(
			z.object({
				created: z.string(),
				filId: z.number(),
				loyaltyFactId: z.number(),
			}),
		),
	});
	const line = z.object({
		lagerId: z.number(),
		lagerNameUA: z.string(),
		lagerUnit: z.string(),
		kolvo: z.number(),
		priceOut: z.number(),
		sumLine: z.number(),
	});
	const response = BASE_RESPONSE.extend({
		chequesInfos: z.array(
			z.object({
				filId: z.number(),
				chequeId: z.number(),
				created: z.string(),
				sumDiscount: z.number(),
				chequeLines: z.array(line),
			}),
		),
	});

	/** @type {Body} */
	const body = { Method: "GetChequesInfos", Data: data.parse({ identities }) };
	const resp = await request(body, account.userInfo, account.accessToken);
	return response.parse(await resp.json());
}

/**
 * @typedef {|
 *   { Method: "CheckUser" | "RegisterUser" | "RefreshToken" | "GetLastChequeHeadersFast"; Data: {} }
 * | { Method: "SendOTP"; Data: { guid: string; phone: string } }
 * | { Method: "ConfirmationOtp_V2"; Data: { otpCode: string; guid: string; phone: string; captcha?: string } }
 * | { Method: "RegisterUserReferral"; Data: { referrerGuid: string; guid: string; phone: string } }
 * | { Method: "SetBonusToApply"; Data: { bonuseCancellationId: number; guid: string; phone: string } }
 * | { Method: "GetAppConfigurations_V4"; Data: { platform: number } }
 * | { Method: "GetPersonalInfo_V6"; Data: { forceUpdate: boolean } }
 * | { Method: "ChangePersonalInfo"; Data: { toUpdate: { birthday: string } } }
 * | { Method: "GetChequesInfos"; Data: { identities: { created: string; filId: number; loyaltyFactId: number }[] } }
 * | { Method: "GetPersonalInfoBonus"; Data: { guid: string; phone: string } }
 * } Body
 */

/**
 * Makes a request to the Fora App API with retrying
 * @param {Body} body
 * @param {string} userInfo
 * @param {string} [token]
 * @returns {Promise<Response>}
 */
async function request(body, userInfo, token) {
	const request = new Request(APP_API_URL, {
		method: "POST",
		body: JSON.stringify(body),
		headers: new Headers({
			"user-info": userInfo,
			deviceTime: new Date().toISOString(),
			coordinates: '{"xCoord":0.0,"yCoord":0.0}',
			"content-type": "application/json",
			"user-agent": "okhttp/4.10.0",
		}),
	});
	if (token) {
		request.headers.set("Authorization", `Token ${token}`);
	}

	let count = 3;
	for (;;) {
		try {
			return await fetch(request);
		} catch (error) {
			console.error("[RETRY]", (count -= 1), error);
			if (count < 0) throw error;
			// TODO: add exponential backoff
		}
	}
}

/**
 * All the necessary fields for spoofing HWID for the Fora App API
 * @typedef {Pick<typeof import("$lib/schema/public").devices.$inferSelect, "brand" | "model" | "fingerprint">} Device
 */

/**
 * Creates a HWID for the Fora App API
 * @param {Device} device
 * @returns {string}
 * @throws {Error}
 */
function getUserInfo({ brand, model, fingerprint }) {
	const parsed = fingerprint.match(/:(?<release>.+?)\//);
	if (parsed === null || parsed.groups === undefined) {
		throw new Error(`Unexpected fingerprint: ${fingerprint}`);
	}
	const release = parsed.groups.release;
	const releases = [
		{ sdk_int: 33, release: "13", android: "Android" },
		{ sdk_int: 32, release: "12.1", android: "Android" },
		{ sdk_int: 31, release: "12", android: "Android" },
		{ sdk_int: 30, release: "11", android: "Android" },
		{ sdk_int: 29, release: "10", android: "Q (Android 10.0)" },
		{ sdk_int: 28, release: "9", android: "Pie (Android 9.0)" },
		{ sdk_int: 27, release: "8.1", android: "Oreo (Android 8.1)" },
		{ sdk_int: 26, release: "8", android: "Oreo (Android 8.0)" },
		{ sdk_int: 25, release: "7.1", android: "Nougat (Android 7.1.1)" },
		{ sdk_int: 24, release: "7", android: "Nougat (Android 7.0)" },
	];

	for (const version of releases) {
		if (release.startsWith(version.release)) {
			return JSON.stringify({
				geolocationTrackingCode: 0,
				pushNotificationTrackingCode: "0",
				root: "false",
				appVersionCode: APP_VERSION_CODE,
				appVersionName: APP_VERSION_NAME,
				androidVersion: version.android,
				brand: brand,
				model: model,
				sdkRelease: version.release,
				sdkVersion: version.sdk_int.toString(),
			});
		}
	}
	throw new Error(`Unexpected release: ${release}`);
}
