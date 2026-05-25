import { Resource, databases, logger } from 'harper';

const { SiteImages: SiteImagesTable } = databases.EarlyHints;

const toRelativeIfSameOrigin = (imageUrl: string, pageUrl: string): string => {
	try {
		const imgUrl = new URL(imageUrl, pageUrl);
		const pageOrigin = new URL(pageUrl).origin;
		if (imgUrl.origin !== pageOrigin) return imageUrl;
		return `${imgUrl.pathname}${imgUrl.search}${imgUrl.hash}`;
	} catch {
		return imageUrl;
	}
};

const getSiteImages = async (cacheKey: string): Promise<string[]> => {
	logger.info(`Fetching site images for version|url: ${cacheKey}`);
	const result = await SiteImagesTable.get(cacheKey);

	if (!result?.hints) {
		return [];
	}

	return result.hints.map((image: string) => {
		const url = cacheKey.split('|')[1];
		const rel = toRelativeIfSameOrigin(image, url);
		return `<${rel};rel=preload;as=image;crossorigin>`;
	});
};

const getSafariPreconnects = (hints: string[]): string => {
	const preconnectHints = new Set<string>();
	for (const hint of hints) {
		let url: string = '';
		if (hint.startsWith('<')) {
			// Extract the url if formatted as a link header
			url = hint.split(';')[0].replace('<', '').replace('>', '');
		}

		let domain: string = '';
		if (!url.startsWith('//') && !url.startsWith('http')) {
			logger.info(`Skipping relative or invalid URL: ${url}`);
			continue;
		} else {
			const urlObj = new URL(url.startsWith('//') ? `https:${url}` : url);
			domain = urlObj.origin;
		}

		preconnectHints.add(`<${domain}>;rel=preconnect;crossorigin`);
	}
	return Array.from(preconnectHints.values()).join(',');
};

// @ts-ignore - Harper v5 static get incompatible with base class property type declaration
export class GetHints extends Resource {
	allowRead(user: any): boolean {
		return ['super_user', 'read_only_user'].includes(user?.role?.id);
	}

	static async get(target: any, context: any): Promise<object> {
		// const deviceType = target.get('d') || 'desktop';
		const queryUrl = target.get('q');
		const url = queryUrl ? decodeURIComponent(queryUrl) : null;

		const hintsVersion = target.get('v') ? parseInt(target.get('v') as string, 10) : 1;
		const isSafari = target.get('s') === '1';

		// Device width can be used for selecting different images based on size
		// const deviceWidth = query.get('w') ? parseInt(query.get('w') as string, 10) : 0;

		if (!url) {
			return {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
				data: { error: 'Missing URL in "q" query parameter' },
			};
		}

		logger.info(`Fetching the early hints for URL: ${url}`);

		const cacheKey = `${hintsVersion}|${url}`;
		const SiteImages = await getSiteImages(cacheKey);
		if (SiteImages.length === 0) {
			return {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
				data: { error: 'No early hints found for the provided URL' },
			};
		}

		let earlyHints: string = '';
		if (isSafari) {
			earlyHints = getSafariPreconnects(SiteImages);
		} else {
			earlyHints = [...SiteImages].join(',');
		}

		return { status: 200, headers: { 'Content-Type': 'application/json' }, data: earlyHints };
	}
}
