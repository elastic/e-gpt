import { collections } from "$lib/server/database";
import { authCondition } from "$lib/server/auth";
import type { Conversation } from "$lib/types/Conversation";
import apm from "$lib/server/apmSingleton";

const spanTypeName = "user_conversations_server_ts";
const NUM_PER_PAGE = 300;

export async function GET({ locals, url }) {
	const getTransaction = apm.startTransaction("GET /api/conversations/+server", "request");
	getTransaction.setLabel("sessionID", locals.sessionId);
	getTransaction.setLabel("userEmail", locals.user?.email);

	const p = parseInt(url.searchParams.get("p") ?? "0");

	const findConversationsSpan = getTransaction.startSpan("Find Conversations", spanTypeName);
	if (locals.user?._id || locals.sessionId) {
		const convs = await collections.conversations
			.find({
				...authCondition(locals),
			})
			.project<Pick<Conversation, "_id" | "title" | "updatedAt" | "model">>({
				title: 1,
				updatedAt: 1,
				model: 1,
			})
			.sort({ updatedAt: -1 })
			.skip(p * NUM_PER_PAGE)
			.limit(NUM_PER_PAGE)
			.toArray();

		const res = convs.map((conv) => ({
			id: conv._id,
			title: conv.title,
			updatedAt: conv.updatedAt,
			modelId: conv.model,
		}));

		findConversationsSpan?.end();
		getTransaction.end();
		return Response.json(res);
	} else {
		apm.captureError(new Error("Must have session cookie"));
		getTransaction.setOutcome("failure");
		getTransaction.end();
		return Response.json({ message: "Must have session cookie" }, { status: 401 });
	}
}
