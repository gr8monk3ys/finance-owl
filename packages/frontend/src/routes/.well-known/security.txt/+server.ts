import { publicLinks, publicSite } from '$lib/config/public';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const expires = new Date();
	expires.setFullYear(expires.getFullYear() + 1);

	const body = [
		`Contact: mailto:${publicSite.securityEmail}`,
		`Contact: ${publicLinks.securityUrl}`,
		`Policy: ${publicLinks.securityUrl}`,
		`Canonical: ${publicLinks.securityTextUrl}`,
		`Expires: ${expires.toISOString()}`,
		'Preferred-Languages: en'
	].join('\n');

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=0, s-maxage=3600'
		}
	});
};
