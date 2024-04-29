import { models } from "$lib/server/models";
import apm from "$lib/server/apmSingleton";

export async function GET() {
	const getTransaction = apm.startTransaction("GET /api/models/+server", "request");
	const res = models
		.filter((m) => m.unlisted == false)
		.map((model) => ({
			id: model.id,
			name: model.name,
			websiteUrl: model.websiteUrl ?? "https://huggingface.co",
			modelUrl: model.modelUrl ?? "https://huggingface.co",
			tokenizer: model.tokenizer,
			datasetName: model.datasetName,
			datasetUrl: model.datasetUrl,
			displayName: model.displayName,
			description: model.description ?? "",
			logoUrl: model.logoUrl,
			promptExamples: model.promptExamples ?? [],
			preprompt: model.preprompt ?? "",
			multimodal: model.multimodal ?? false,
			unlisted: model.unlisted ?? false,
		}));
	getTransaction.end();
	return Response.json(res);
}
