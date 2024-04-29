import { z } from "zod";
import type { Embedding, EmbeddingEndpoint } from "../embeddingEndpoints";
import { chunk } from "$lib/utils/chunk";
import { OPENAI_API_KEY } from "$env/static/private";

import apm from "$lib/server/apmSingleton";

export const embeddingEndpointOpenAIParametersSchema = z.object({
	weight: z.number().int().positive().default(1),
	model: z.any(),
	type: z.literal("openai"),
	url: z.string().url().default("https://api.openai.com/v1/embeddings"),
	apiKey: z.string().default(OPENAI_API_KEY),
});

export async function embeddingEndpointOpenAI(
	input: z.input<typeof embeddingEndpointOpenAIParametersSchema>
): Promise<EmbeddingEndpoint> {
	const transaction = apm.startTransaction("/lib/server/embeddingEndpoints/openai", "custom");
	transaction.setLabel("type", "openai-embedding");
	transaction.setLabel("url", input.url);

	const { url, model, apiKey } = embeddingEndpointOpenAIParametersSchema.parse(input);
	const maxBatchSize = model.maxBatchSize || 100;

	return async ({ inputs }) => {
		const requestURL = new URL(url);

		const batchesInputs = chunk(inputs, maxBatchSize);

		const batchesResults = await Promise.all(
			batchesInputs.map(async (batchInputs) => {
				const embeddingCallSpan = transaction.startSpan(
					"OpenAI Embeddings API Call",
					"openai-embedding-api-call"
				);
				const response = await fetch(requestURL, {
					method: "POST",
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
						...(apiKey ? { "Api-Key": apiKey } : {}),
					},
					body: JSON.stringify({ input: batchInputs, model: model.name }),
				});

				const embeddings: Embedding[] = [];
				const responseObject = await response.json();
				for (const embeddingObject of responseObject.data) {
					embeddings.push(embeddingObject.embedding);
				}
				embeddingCallSpan?.end();
				return embeddings;
			})
		);

		transaction.end();
		return batchesResults.flat();
	};
}
