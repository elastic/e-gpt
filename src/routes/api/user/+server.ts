import apm from "$lib/server/apmSingleton";

export async function GET({ locals }) {
	const getTransaction = apm.startTransaction("GET /api/user/+server", "request");
	getTransaction.setLabel("sessionID", locals.sessionId);
	if (locals.user) {
		const res = {
			id: locals.user._id,
			username: locals.user.username,
			name: locals.user.name,
			email: locals.user.email,
			avatarUrl: locals.user.avatarUrl,
			hfUserId: locals.user.hfUserId,
		};
		getTransaction.setLabel("userEmail", locals.user.email);
		getTransaction.end();
		return Response.json(res);
	}
	apm.captureError(new Error("Must be signed in"));
	getTransaction.setOutcome("failure");
	getTransaction.end();

	return Response.json({ message: "Must be signed in" }, { status: 401 });
}
