import { collections } from "$lib/server/database";
import { authCondition } from "$lib/server/auth";
import { z } from "zod";
import { ObjectId } from "mongodb";

import apm from '$lib/server/apmSingleton';
import handleError from '$lib/server/apmHandleError';

export async function GET({ locals, params }) {

	const transaction = apm.startTransaction("GET Conversation");
	try {
		const id = z.string().parse(params.id);
		const convId = new ObjectId(id);

		if (!locals.user?._id && !locals.sessionId) {
			// Log unauthorized access attempts
			const error = new Error("Unauthorized: Must have session cookie");
			handleError(error, transaction, "Unauthorized access attempt");
			transaction?.end('error');
			return Response.json({ message: error.message }, { status: 401 });
		}

		const conv = await collections.conversations.findOne({
			_id: convId,
			...authCondition(locals),
		});

		if (!conv) {
			// Log not found errors
			const error = new Error("Not Found: Conversation not found");
			handleError(error, transaction, "Failed to find conversation");
			transaction?.end('error');
			return Response.json({ message: error.message }, { status: 404 });
		}

		const res = {
			id: conv._id,
			title: conv.title,
			updatedAt: conv.updatedAt,
			modelId: conv.model,
			messages: conv.messages.map((message) => ({
				content: message.content,
				from: message.from,
				id: message.id,
				createdAt: message.createdAt,
				updatedAt: message.updatedAt,
				webSearch: message.webSearch,
			})),
		};

		transaction?.end('success');
		return Response.json(res);

	} catch (error) {
		handleError(error, transaction, "Error fetching conversation data");
		throw error;  // Rethrow the error after logging it
	} finally {
		if (transaction) {
			transaction.end('failure');
		}
	}
}
