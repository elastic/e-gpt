import apm from "elastic-apm-node";
import { env } from "$env/dynamic/private";

// Singleton: Check if the APM instance is already started to prevent reinitialization
if (!apm.isStarted()) {
	apm.start({
		serviceName: env.ELASTICSEARCH_APM_SERVICE_NAME + "-" + env.ELASTICSEARCH_ENVIRONMENT,
		secretToken: env.ELASTICSEARCH_APM_SECRET_TOKEN,
		serverUrl: env.ELASTICSEARCH_APM_URL,
		environment: env.ELASTICSEARCH_ENVIRONMENT,
	});
}

export default apm;
