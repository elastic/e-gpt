import { base } from "$app/paths";
import { authCondition } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { redirect } from "@sveltejs/kit";

import apm from "$lib/server/apmSingleton";
const spanTypeName = "pageServer_ts";

export const actions = {
	async delete({ locals }) {
		const span = apm.startSpan("deleteConversations", spanTypeName);
		apm.setLabel("sessionID", locals.sessionId);
		apm.setLabel("userEmail", locals.user?.email);

		// double check we have a user to delete conversations for
		if (locals.user?._id || locals.sessionId) {
			await collections.conversations.deleteMany({
				...authCondition(locals),
			});
		}
		span?.end();

		throw redirect(303, `${base}/`);
	},
};
