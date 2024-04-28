import { authCondition } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { error } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import { z } from "zod";
import type { RequestHandler } from "./$types";
import { downloadFile } from "$lib/server/files/downloadFile";

import apm from "$lib/server/apmSingleton";
const spanTypeName = "conversation_output_server_ts";

export const GET: RequestHandler = async ({ locals, params }) => {
	const getTransaction = apm.startTransaction(
		"GET /conversation/[id]/output/[sha256]/+server",
		"request"
	);
	apm.setLabel("sessionID", locals.sessionId);
	apm.setLabel("userEmail", locals.user?.email);
	apm.setLabel("conversationId", params.id);

	const sha256 = z.string().parse(params.sha256);

	const userId = locals.user?._id ?? locals.sessionId;

	// check user
	if (!userId) {
		getTransaction.setOutcome("failure");
		throw error(401, "Unauthorized");
	}

	const findConversationSpan = getTransaction.startSpan("Find Conversation", spanTypeName);
	if (params.id.length !== 7) {
		const convId = new ObjectId(z.string().parse(params.id));

		// check if the user has access to the conversation
		const conv = await collections.conversations.findOne({
			_id: convId,
			...authCondition(locals),
		});

		if (!conv) {
			getTransaction.setOutcome("failure");
			throw error(404, "Conversation not found");
		}
	} else {
		// check if the user has access to the conversation
		const conv = await collections.sharedConversations.findOne({
			_id: params.id,
		});

		if (!conv) {
			getTransaction.setOutcome("failure");
			throw error(404, "Conversation not found");
		}
	}
	findConversationSpan?.end();

	const downloadFileSpan = getTransaction.startSpan("Download File", spanTypeName);
	const { content, mime } = await downloadFile(sha256, params.id);
	downloadFileSpan?.end();

	getTransaction.end();

	return new Response(content, {
		headers: {
			"Content-Type": mime ?? "application/octet-stream",
		},
	});
};
