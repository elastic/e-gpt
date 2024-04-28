import { authCondition } from "$lib/server/auth";
import type { Conversation } from "$lib/types/Conversation";
import { collections } from "$lib/server/database";
import { ObjectId } from "mongodb";

import apm from "$lib/server/apmSingleton";
const spanTypeName = "user_assistants_server_ts";

export async function GET({ locals }) {
	const getTransaction = apm.startTransaction("GET /api/user/assistants/+server", "request");
	getTransaction.setLabel("sessionID", locals.sessionId);
	getTransaction.setLabel("userEmail", locals.user?.email);

	if (locals.user?._id || locals.sessionId) {
		const settings = await collections.settings.findOne(authCondition(locals));

		const findConversationsSpan = getTransaction.startSpan("Find Conversations", spanTypeName);
		const conversations = await collections.conversations
			.find(authCondition(locals))
			.sort({ updatedAt: -1 })
			.project<Pick<Conversation, "assistantId">>({
				assistantId: 1,
			})
			.limit(300)
			.toArray();
		findConversationsSpan?.end();

		const findAssistantsSpan = getTransaction.startSpan("Find Assistants", spanTypeName);
		const userAssistants = settings?.assistants?.map((assistantId) => assistantId.toString()) ?? [];
		const userAssistantsSet = new Set(userAssistants);

		const assistantIds = [
			...userAssistants.map((el) => new ObjectId(el)),
			...(conversations.map((conv) => conv.assistantId).filter((el) => !!el) as ObjectId[]),
		];

		const assistants = await collections.assistants.find({ _id: { $in: assistantIds } }).toArray();

		const res = assistants
			.filter((el) => userAssistantsSet.has(el._id.toString()))
			.map((el) => ({
				...el,
				_id: el._id.toString(),
				createdById: undefined,
				createdByMe:
					el.createdById.toString() === (locals.user?._id ?? locals.sessionId).toString(),
			}));

		findAssistantsSpan?.end();
		getTransaction.end();

		return Response.json(res);
	} else {
		apm.captureError(new Error("Must have session cookie"));
		getTransaction.setOutcome("failure");
		return Response.json({ message: "Must have session cookie" }, { status: 401 });
	}
}
