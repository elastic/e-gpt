import { authCondition } from "$lib/server/auth";
import { collections } from "$lib/server/database";
import type { SharedConversation } from "$lib/types/SharedConversation";
import { getShareUrl } from "$lib/utils/getShareUrl";
import { hashConv } from "$lib/utils/hashConv";
import { error } from "@sveltejs/kit";
import { ObjectId } from "mongodb";
import { nanoid } from "nanoid";

import apm from "$lib/server/apmSingleton";
const spanTypeName = "conversation_share_server_ts";

export async function POST({ params, url, locals }) {
	const postTransaction = apm.startTransaction("POST /conversation/[id]/share/+server", "request");
	apm.setLabel("sessionID", locals.sessionId);
	apm.setLabel("userEmail", locals.user?.email);
	apm.setLabel("conversationId", params.id);

	const findConversationSpan = postTransaction.startSpan("Find Conversation", spanTypeName);
	const conversation = await collections.conversations.findOne({
		_id: new ObjectId(params.id),
		...authCondition(locals),
	});

	if (!conversation) {
		throw error(404, "Conversation not found");
	}
	findConversationSpan?.end();

	const findHashSpan = postTransaction.startSpan("Find Hash Conversation", spanTypeName);
	const hash = await hashConv(conversation);

	const existingShare = await collections.sharedConversations.findOne({ hash });
	findHashSpan?.end();

	if (existingShare) {
		postTransaction.end();
		return new Response(
			JSON.stringify({
				url: getShareUrl(url, existingShare._id),
			}),
			{ headers: { "Content-Type": "application/json" } }
		);
	}

	const createShareSpan = postTransaction.startSpan("Create Shared Conversation", spanTypeName);
	const shared: SharedConversation = {
		_id: nanoid(7),
		hash,
		createdAt: new Date(),
		updatedAt: new Date(),
		rootMessageId: conversation.rootMessageId,
		messages: conversation.messages,
		title: conversation.title,
		model: conversation.model,
		embeddingModel: conversation.embeddingModel,
		preprompt: conversation.preprompt,
		assistantId: conversation.assistantId,
	};

	await collections.sharedConversations.insertOne(shared);

	// copy files from `${conversation._id}-` to `${shared._id}-`
	const files = await collections.bucket
		.find({ filename: { $regex: `${conversation._id}-` } })
		.toArray();

	await Promise.all(
		files.map(async (file) => {
			const newFilename = file.filename.replace(`${conversation._id}-`, `${shared._id}-`);
			// copy files from `${conversation._id}-` to `${shared._id}-` by downloading and reuploaidng
			const downloadStream = collections.bucket.openDownloadStream(file._id);
			const uploadStream = collections.bucket.openUploadStream(newFilename, {
				metadata: { ...file.metadata, conversation: shared._id.toString() },
			});
			downloadStream.pipe(uploadStream);
		})
	);
	createShareSpan?.end();

	postTransaction.end();

	return new Response(
		JSON.stringify({
			url: getShareUrl(url, shared._id),
		}),
		{ headers: { "Content-Type": "application/json" } }
	);
}
