import { env } from "$env/dynamic/private";
import { Client } from "@elastic/elasticsearch";

// Load Elastic configuration from environment variables
const elasticUrl = env.ELASTICSEARCH_LOGS_URL;
const elasticApiKey = env.ELASTICSEARCH_LOGS_API_KEY ?? "";

// Create Elastic client with API token
const client = new Client({
	node: elasticUrl,
	auth: {
		apiKey: elasticApiKey,
	},
});

// Verify connection with a ping request
async function checkElasticsearchConnection() {
	try {
		await client.ping();
		console.log("Connected to Elasticsearch successfully!");
	} catch (error) {
		console.error("Elasticsearch connection failed:", error);
	}
}

// Run the connection check
checkElasticsearchConnection();

// Index name
const indexName: string = env.ELASTICSEARCH_LOGS_INDEX_NAME ?? "elastic-gpt-dev-logs";

// Ensure index exists before logging
async function ensureIndexExists(index: string) {
	const exists = await client.indices.exists({ index });
	if (!exists) {
		await client.indices.create({ index });
		console.log(`Created index: ${index}`);
	} else {
		// Delete existing index
		console.log(`Index cleared: ${index}`);
	}
}

// Initialize index existence
ensureIndexExists(indexName).catch((error) => {
	console.error(`Error checking or creating index ${indexName}:`, error);
});

// Utility to flatten a nested object into a flat object using dot notation
const flattenObject = (
	obj: Record<string, unknown>,
	parentKey = "",
	result: Record<string, unknown> = {}
): Record<string, unknown> => {
	const hasOwnProperty = Object.prototype.hasOwnProperty;
	for (const key in obj) {
		if (hasOwnProperty.call(obj, key)) {
			const newKey = parentKey ? `${parentKey}.${key}` : key;
			const value = obj[key];

			if (value && typeof value === "object" && !Array.isArray(value)) {
				flattenObject(value as Record<string, unknown>, newKey, result);
			} else {
				result[newKey] = value;
			}
		}
	}
	return result;
};

// Utility to safely format and flatten messages
const formatAndFlattenMessages = (...messages: unknown[]): Record<string, unknown> => {
	const flatMessages: Record<string, unknown> = {};
	const concatenatedMessages: string[] = [];

	// Process each message
	for (const message of messages) {
		if (message instanceof Error) {
			concatenatedMessages.push(message.stack || message.message);
		} else if (typeof message === "object" && message !== null) {
			Object.assign(flatMessages, flattenObject(message as Record<string, unknown>));
		} else {
			concatenatedMessages.push(String(message));
		}
	}

	// Concatenate all string messages into a single string field
	if (concatenatedMessages.length > 0) {
		flatMessages.message = concatenatedMessages.join(" ");
	}
	return flatMessages;
};

// Unified log function that accepts different overload signatures
function log(
	level: "info" | "debug" | "warn" | "error",
	extraFields?: Record<string, unknown>,
	...messages: unknown[]
): void;
function log(level: "info" | "debug" | "warn" | "error", ...messages: unknown[]): void;
function log(
	level: "info" | "debug" | "warn" | "error",
	arg1?: Record<string, unknown> | unknown,
	...messages: unknown[]
): void {
	let extraFields: Record<string, unknown> | undefined;
	const actualMessages: unknown[] = [];

	// Determine if the first argument is an object with extra fields
	if (typeof arg1 === "object" && arg1 !== null && !Array.isArray(arg1)) {
		extraFields = arg1 as Record<string, unknown>;
		actualMessages.push(...messages);
	} else {
		actualMessages.push(arg1, ...messages);
	}

	// Format and flatten the messages
	const formattedMessages = formatAndFlattenMessages(...actualMessages);

	// Create the log body with formatted messages and additional fields
	const body = {
		level,
		timestamp: new Date().toISOString(),
		...formattedMessages,
		...(extraFields ?? {}), // Merge extra fields if they exist
	};

	client.index({
		index: indexName,
		body,
	});
}

// Exported logger object for different log levels using overloads
export const logger = {
	info: (...args: unknown[]) => log("info", ...args),
	debug: (...args: unknown[]) => log("debug", ...args),
	warn: (...args: unknown[]) => log("warn", ...args),
	error: (...args: unknown[]) => log("error", ...args),
};
