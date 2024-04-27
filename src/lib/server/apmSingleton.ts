import apm from 'elastic-apm-node';

import {
	ELASTICSEARCH_ENVIRONMENT,
	ELASTICSEARCH_URL,
	ELASTICSEARCH_SERVICE_NAME,
	ELASTICSEARCH_SECRET_TOKEN
} from "$env/static/private";

// Singleton: Check if the APM instance is already started to prevent reinitialization
if (!apm.isStarted()) {
	apm.start({
		serviceName: ELASTICSEARCH_SERVICE_NAME,
		secretToken: ELASTICSEARCH_SECRET_TOKEN,
		serverUrl: ELASTICSEARCH_URL,
		environment: ELASTICSEARCH_ENVIRONMENT,
	});
}

export default apm;