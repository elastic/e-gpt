import { dev } from "$app/environment";
import { base } from "$app/paths";
import { COOKIE_NAME } from "$env/static/private";
import { collections } from "$lib/server/database";
import { redirect } from "@sveltejs/kit";

import apm from "$lib/server/apmSingleton";

const spanTypeName = "logout_page_server_ts";

export const actions = {
	async default({ cookies, locals }) {
		apm.setLabel("sessionId", locals.sessionId);
		apm.setLabel("userId", locals.user?.email);

		const deleteSessionFromCollectionSpan = apm.startSpan("Deleting Session", spanTypeName);
		await collections.sessions.deleteOne({ sessionId: locals.sessionId });
		deleteSessionFromCollectionSpan?.end();

		const deleteCookieSpan = apm.startSpan("Deleting Cookie", spanTypeName);
		cookies.delete(COOKIE_NAME, {
			path: "/",
			// So that it works inside the space's iframe
			sameSite: dev ? "lax" : "none",
			secure: !dev,
			httpOnly: true,
		});

		deleteCookieSpan?.end();

		throw redirect(303, `${base}/`);
	},
};
