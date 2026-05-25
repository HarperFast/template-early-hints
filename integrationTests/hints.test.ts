/**
 * Integration tests for the GetHints resource.
 * Tests the /hints endpoint (exported as `hints = GetHints`).
 * Seed data is loaded automatically via index.ts on worker 0.
 */
import { suite, test, before, after } from 'node:test';
import { strictEqual, ok } from 'node:assert/strict';
import { setupHarperWithFixture, teardownHarper, type ContextWithHarper } from '@harperfast/integration-testing';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(__dirname, '..');

function basicAuth(username: string, password: string): string {
	return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

// URL from seedData.json
const SEEDED_URL = 'https://www.harper.fast/';
const ENCODED_URL = encodeURIComponent(SEEDED_URL);

suite('GetHints resource', (ctx: ContextWithHarper) => {
	before(async () => {
		await setupHarperWithFixture(ctx, fixtureDir);
	});

	after(async () => {
		await teardownHarper(ctx);
	});

	test('GET /hints with invalid credentials returns 401', async () => {
		const { httpURL } = ctx.harper;
		const res = await fetch(`${httpURL}/hints?q=${ENCODED_URL}`, {
			headers: {
				Authorization: 'Basic ' + Buffer.from('bad:credentials').toString('base64'),
			},
		});
		strictEqual(res.status, 401);
	});

	test('GET /hints without q param returns 400', async () => {
		const { admin, httpURL } = ctx.harper;
		const res = await fetch(`${httpURL}/hints`, {
			headers: { Authorization: basicAuth(admin.username, admin.password) },
		});
		strictEqual(res.status, 400);
		const body = await res.json();
		ok(body.error, 'expected error message in body');
	});

	test('GET /hints with unknown URL returns 404', async () => {
		const { admin, httpURL } = ctx.harper;
		const unknownUrl = encodeURIComponent('https://unknown.example.com/no-hints-here');
		const res = await fetch(`${httpURL}/hints?q=${unknownUrl}`, {
			headers: { Authorization: basicAuth(admin.username, admin.password) },
		});
		strictEqual(res.status, 404);
		const body = await res.json();
		ok(body.error, 'expected error message in body');
	});

	test('GET /hints with seeded URL returns 200 and preload link headers', async () => {
		const { admin, httpURL } = ctx.harper;
		const res = await fetch(`${httpURL}/hints?q=${ENCODED_URL}`, {
			headers: { Authorization: basicAuth(admin.username, admin.password) },
		});
		strictEqual(res.status, 200);
		const body = await res.json();
		ok(typeof body === 'string', `expected string body, got ${typeof body}`);
		ok(body.includes('rel=preload'), `expected rel=preload in body, got: ${body}`);
		ok(body.includes('as=image'), `expected as=image in body, got: ${body}`);
	});

	test('GET /hints with s=1 (Safari) returns preconnect hints', async () => {
		const { admin, httpURL } = ctx.harper;
		const res = await fetch(`${httpURL}/hints?q=${ENCODED_URL}&s=1`, {
			headers: { Authorization: basicAuth(admin.username, admin.password) },
		});
		strictEqual(res.status, 200);
		const body = await res.json();
		ok(typeof body === 'string', `expected string body, got ${typeof body}`);
		// Safari mode returns preconnect hints instead of preload
		ok(body.includes('rel=preconnect'), `expected rel=preconnect in Safari mode, got: ${body}`);
	});

	test('GET /hints with v=1 explicitly returns same as default', async () => {
		const { admin, httpURL } = ctx.harper;
		const res1 = await fetch(`${httpURL}/hints?q=${ENCODED_URL}`, {
			headers: { Authorization: basicAuth(admin.username, admin.password) },
		});
		const res2 = await fetch(`${httpURL}/hints?q=${ENCODED_URL}&v=1`, {
			headers: { Authorization: basicAuth(admin.username, admin.password) },
		});
		strictEqual(res1.status, 200);
		strictEqual(res2.status, 200);
		const body1 = await res1.json();
		const body2 = await res2.json();
		strictEqual(body1, body2);
	});

	test('GET /site-images is accessible with admin auth', async () => {
		const { admin, httpURL } = ctx.harper;
		// Table is exported with @export(name: "site-images") in schema
		const res = await fetch(`${httpURL}/site-images/`, {
			headers: { Authorization: basicAuth(admin.username, admin.password) },
		});
		strictEqual(res.status, 200);
	});
});
