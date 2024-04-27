import type { Conversation } from "$lib/types/Conversation";
import type { TextGenerationStreamOutput } from "@huggingface/inference";
import { endpointTgi, endpointTgiParametersSchema } from "./tgi/endpointTgi";
import { z } from "zod";

import { endpointOAIParametersSchema, endpointOai } from "./openai/endpointOai";
import endpointOllama, { endpointOllamaParametersSchema } from "./ollama/endpointOllama";
import endpointVertex, { endpointVertexParametersSchema } from "./google/endpointVertex";

import type { Model } from "$lib/types/Model";


// parameters passed when generating text
export interface EndpointParameters {
	messages: Omit<Conversation["messages"][0], "id">[];
	preprompt?: Conversation["preprompt"];
	continueMessage?: boolean; // used to signal that the last message will be extended
	generateSettings?: Partial<Model["parameters"]>;
}

interface CommonEndpoint {
	weight: number;
}
// type signature for the endpoint
export type Endpoint = (
	params: EndpointParameters
) => Promise<AsyncGenerator<TextGenerationStreamOutput, void, void>>;

// generator function that takes in parameters for defining the endpoint and return the endpoint
export type EndpointGenerator<T extends CommonEndpoint> = (parameters: T) => Endpoint;

// list of all endpoint generators
export const endpoints = {
	tgi: endpointTgi,
	openai: endpointOai,
	ollama: endpointOllama,
	vertex: endpointVertex,
};

export const endpointSchema = z.discriminatedUnion("type", [
	endpointOAIParametersSchema,
	endpointTgiParametersSchema,
	endpointOllamaParametersSchema,
	endpointVertexParametersSchema,
]);
export default endpoints;
