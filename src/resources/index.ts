import { databases, logger, server } from 'harper';
import { GetHints } from './hints.js';
import { type SiteImages } from '../types/graphql.js';
import seedData from '../../data/seedData.json' with { type: 'json' };

const { SiteImages: SiteImagesTable } = databases.EarlyHints;

if (server.workerIndex === 0) {
	logger.info('Seeding SiteImages Database');
	seedData.forEach((item: SiteImages) => {
		SiteImagesTable.put(item);
	});
}

export const hints = GetHints;
