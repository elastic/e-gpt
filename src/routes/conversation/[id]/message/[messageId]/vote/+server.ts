import { authCondition } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import { error } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import { z } from "zod";

import apm from "$lib/server/apmSingleton";
const spanTypeName = "message_vote_server_ts";

export async function POST({ params, request, locals }) {
	const getTransaction = apm.startTransaction(
		"POST /conversation/[id]/message/[messageId]/vote/+server",
		"request"
	);

	const { score } = z
		.object({
			score: z.number().int().min(-1).max(1),
		})
		.parse(await request.json());
	const conversationId = new ObjectId(params.id);
	const messageId = params.messageId;

	apm.setLabel("sessionID", locals.sessionId);
	apm.setLabel("userEmail", locals.user?.email);
	apm.setLabel("conversationId", params.id);

	const updateConversationSpan = getTransaction.startSpan("Update Conversation", spanTypeName);
	const document = await collections.conversations.updateOne(
		{
			_id: conversationId,
			...authCondition(locals),
			"messages.id": messageId,
		},
		{
			...(score !== 0
				? {
						$set: {
							"messages.$.score": score,
						},
				  }
				: { $unset: { "messages.$.score": "" } }),
		}
	);
	updateConversationSpan?.end();

	if (!document.matchedCount) {
		getTransaction.setOutcome("failure");
		throw error(404, "Message not found");
	}

	getTransaction.end();

	return new Response();
}
