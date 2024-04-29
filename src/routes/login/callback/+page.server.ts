import { redirect, error } from "@sveltejs/kit";
import { getOIDCUserData, validateAndParseCsrfToken } from "$lib/server/auth";
import { z } from "zod";
import { base } from "$app/paths";
import { updateUser } from "./updateUser";
import { ALLOWED_USER_EMAILS } from "$env/static/private";
import JSON5 from "json5";
import apm from "$lib/server/apmSingleton";

const spanTypeName = "callback_page_server_ts";

const allowedUserEmails = z
	.array(z.string().email())
	.optional()
	.default([])
	.parse(JSON5.parse(ALLOWED_USER_EMAILS));

export async function load({ url, locals, cookies, request, getClientAddress }) {
	const errorParamsSpan = apm.startSpan("Parse Error Parameters", spanTypeName);
	const { error: errorName, error_description: errorDescription } = z
		.object({
			error: z.string().optional(),
			error_description: z.string().optional(),
		})
		.parse(Object.fromEntries(url.searchParams.entries()));

	errorParamsSpan?.end();

	if (errorName) {
		throw error(400, errorName + (errorDescription ? ": " + errorDescription : ""));
	}

	const { code, state } = z
		.object({
			code: z.string(),
			state: z.string(),
		})
		.parse(Object.fromEntries(url.searchParams.entries()));

	const csrfTokenSpan = apm.startSpan("Parse CSRF Token", spanTypeName);

	const csrfToken = Buffer.from(state, "base64").toString("utf-8");
	const validatedToken = await validateAndParseCsrfToken(csrfToken, locals.sessionId);

	csrfTokenSpan?.end();

	if (!validatedToken) {
		throw error(403, "Invalid or expired CSRF token");
	}

	const userFilterSpan = apm.startSpan("Filter User", spanTypeName);
	const { userData } = await getOIDCUserData({ redirectURI: validatedToken.redirectUrl }, code);

	// Filter by allowed user emails
	if (allowedUserEmails.length > 0) {
		if (!userData.email) {
			throw error(403, "User not allowed: email not returned");
		}
		const emailVerified = userData.email_verified ?? true;
		if (!emailVerified) {
			throw error(403, "User not allowed: email not verified");
		}
		if (!allowedUserEmails.includes(userData.email)) {
			throw error(403, "User not allowed");
		}
	}
	userFilterSpan?.end();

	const updateUserSpan = apm.startSpan("Update User", spanTypeName);
	await updateUser({
		userData,
		locals,
		cookies,
		userAgent: request.headers.get("user-agent") ?? undefined,
		ip: getClientAddress(),
	});
	updateUserSpan?.end();

	throw redirect(302, `${base}/`);
}
