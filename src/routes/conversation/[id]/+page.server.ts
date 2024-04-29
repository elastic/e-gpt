import { collections } from "$lib/server/database";
import { ObjectId } from "mongodb";
import { error } from "@sveltejs/kit";
import { authCondition } from "$lib/server/auth";
import { UrlDependency } from "$lib/types/UrlDependency";
import { convertLegacyConversation } from "$lib/utils/tree/convertLegacyConversation.js";

import apm from "$lib/server/apmSingleton";
const spanTypeName = "+page_server_ts";

export const load = async ({ params, depends, locals }) => {
	const conversationSpan = apm.startSpan("Load Conversation", spanTypeName);
	apm.setLabel("sessionID", locals.sessionId);
	apm.setLabel("userEmail", locals.user?.email);

	let conversation;
	let shared = false;

	if (params.id.length === 7) {
		conversation = await collections.sharedConversations.findOne({
			_id: params.id,
		});
		shared = true;

		if (!conversation) {
			const errorDetails = new Error("Conversation not found");
			apm.captureError(errorDetails);
			throw error(404, errorDetails.message);
		}
	} else {
		conversation = await collections.conversations.findOne({
			_id: new ObjectId(params.id),
			...authCondition(locals),
		});

		depends(UrlDependency.Conversation);

		if (!conversation) {
			const conversationExists =
				(await collections.conversations.countDocuments({
					_id: new ObjectId(params.id),
				})) !== 0;

			if (conversationExists) {
				const errorDetails = new Error(
					"You don't have access to this conversation. If someone gave you this link, ask them to use the 'share' feature instead."
				);
				apm.captureError(errorDetails);
				throw error(403, errorDetails.message);
			}

			const notFoundError = new Error("Conversation not found.");
			apm.captureError(notFoundError);
			throw error(404, notFoundError.message);
		}
	}

	const convertedConv = { ...conversation, ...convertLegacyConversation(conversation) };

	conversationSpan?.end();

	return {
		messages: convertedConv.messages,
		title: convertedConv.title,
		model: convertedConv.model,
		preprompt: convertedConv.preprompt,
		rootMessageId: convertedConv.rootMessageId,
		assistant: convertedConv.assistantId
			? JSON.parse(
					JSON.stringify(
						await collections.assistants.findOne({
							_id: new ObjectId(convertedConv.assistantId),
						})
					)
			  )
			: null,
		shared,
	};
};
