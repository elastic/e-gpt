import apm from "$lib/server/apmSingleton";

/**
 * Handles errors by logging them to the Elastic APM and ending the span if provided.
 * This function only acts if the APM agent is started.
 * @param error The error caught in try-catch blocks.
 * @param span Optional span that might be used for APM tracing, can be null.
 * @param customMessage Optional message to provide additional context for the error.
 */
function handleError(
	error: unknown,
	span?: { end: () => void } | null,
	customMessage?: string
): void {
	if (!apm.isStarted()) {
		return;
	}

	let errorObject: Error;

	// Check if the error is an instance of Error
	if (error instanceof Error) {
		errorObject = error;
	} else {
		// If error is not an instance of Error, convert it to a string and log
		errorObject = new Error(String(error));
	}

	// Add custom message to the error object if provided
	if (customMessage) {
		errorObject.message = `${customMessage}: ${errorObject.message}`;
	}

	// Capture the error using APM
	apm.captureError(errorObject);

	// End the span if it exists
	if (span) {
		span.end();
	}
}

export default handleError;
