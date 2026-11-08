import assert from "node:assert/strict";
import { createHook } from "node:async_hooks";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import photon from "@silvia-odwyer/photon-node";
import { compactImage, worstTilePsnr } from "../src/compact.ts";
import imageCompact from "../src/compress.ts";
import { createReadToolDefinition } from "@earendil-works/pi-coding-agent";

// Dark terminal-style screenshot: glyph-like strokes in text rows, coloured status squares, faint capture noise
// (noise 0 gives the flat background of a real UI capture, where WebP beats Pi's JPEG).
function screenshot(width = 1600, height = 1100, noise = 4): Buffer {
	let seed = 7;
	const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
	const px = new Uint8Array(width * height * 4);
	for (let i = 0; i < px.length; i += 4) {
		const v = 30 + Math.round(rand() * noise);
		px.set([v, v, v, 255], i);
	}
	const paint = (x: number, y: number, w: number, h: number, rgb: number[]) => {
		for (let yy = y; yy < Math.min(y + h, height); yy++) for (let xx = x; xx < Math.min(x + w, width); xx++) px.set([...rgb, 255], (yy * width + xx) * 4);
	};
	for (let row = 0; row < 60; row++) {
		const colour = [[220, 220, 220], [136, 204, 255], [255, 204, 102]][row % 3];
		for (let x = 20; x < 1200; x += 8) if (rand() > 0.25) paint(x, 10 + row * 18, 1 + Math.round(rand() * 5), 9 + Math.round(rand() * 3), colour);
	}
	for (let i = 0; i < 12; i++) paint(1300 + (i % 3) * 60, 100 + i * 70, 40, 40, [[0, 170, 0], [255, 187, 0], [221, 34, 34]][i % 3]);
	return Buffer.from(new photon.PhotonImage(px, width, height).get_bytes());
}
const image = (bytes: Buffer, mimeType = "image/png") => ({ type: "image" as const, data: bytes.toString("base64"), mimeType });
const decode = (data: string) => photon.PhotonImage.new_from_byteslice(Buffer.from(data, "base64"));
const ui = { setStatus() {}, theme: { fg: (color: string, text: string) => `${color}:${text}` } };
function hooks() {
	const handlers: Record<string, (event: any, ctx: any) => Promise<any>> = {};
	imageCompact({ on: (name: string, handler: any) => { handlers[name] = handler; } } as any);
	return handlers;
}

test("screenshot becomes smaller WebP at the same size and passes the worst-tile gate", async () => {
	const input = screenshot();
	assert.ok(input.length > 100 * 1024, `fixture must exceed the skip threshold, got ${input.length}`);
	const data = (await compactImage(input, 1600, 1100, input.length))!;
	assert.ok(Buffer.from(data, "base64").length < input.length * 0.7);
	const [a, b] = [photon.PhotonImage.new_from_byteslice(input), decode(data)];
	assert.deepEqual([b.get_width(), b.get_height()], [1600, 1100]);
	assert.ok(worstTilePsnr(a.get_raw_pixels(), b.get_raw_pixels(), 1600, 1100) >= 40);
	assert.equal(await compactImage(input, 1600, 1100, 1000), undefined, "not smaller than the image it would replace");
	assert.equal(await compactImage(Buffer.alloc(200 * 1024, 7), 10, 10, 1e9), undefined, "undecodable");
});

test("a read PNG that Pi resized to JPEG is re-encoded from the file at the same size", async () => {
	const dir = mkdtempSync(join(tmpdir(), "image-compact-"));
	const png = screenshot(2400, 1650, 0);
	writeFileSync(join(dir, "shot.png"), png);
	writeFileSync(join(dir, "other.png"), screenshot(1650, 2400));
	const source = photon.PhotonImage.new_from_byteslice(png);
	const sized = photon.resize(source, 2000, 1375, photon.SamplingFilter.Lanczos3);
	const jpeg = image(Buffer.from(sized.get_bytes_jpeg(80)), "image/jpeg");
	const handlers = hooks(), ctx = { cwd: dir, hasUI: false, model: {} };
	const read = (path: string) => handlers.tool_result({ toolName: "read", input: { path }, content: [jpeg] }, ctx);
	const out = (await read("shot.png")).content[0];
	assert.equal(out.mimeType, "image/webp");
	assert.ok(out.data.length < jpeg.data.length);
	const webp = decode(out.data);
	assert.deepEqual([webp.get_width(), webp.get_height()], [2000, 1375], "same size, so Pi's coordinate note stays true");
	assert.ok(worstTilePsnr(sized.get_raw_pixels(), webp.get_raw_pixels(), 2000, 1375) >= 40);
	assert.equal(await read("other.png"), undefined, "a file of another shape is not the delivered picture");
	assert.equal(await read("missing.png"), undefined);
	assert.equal(await handlers.tool_result({ toolName: "bash", input: { path: "shot.png" }, content: [jpeg] }, ctx), undefined);
});

test("one damaged tile fails the gate even when the rest of the image is identical", () => {
	const width = 1024, height = 1024;
	const a = new Uint8Array(width * height * 4).fill(30);
	const b = Uint8Array.from(a);
	for (let y = 0; y < 32; y++) b.fill(50, y * width * 4, (y * width + 32) * 4);
	assert.equal(worstTilePsnr(a, a, width, height), Infinity);
	assert.ok(worstTilePsnr(a, b, width, height) < 25); // whole-image PSNR here would be about 52 dB
});

test("Pi's read tool passes the compacted WebP through unchanged", async () => {
	const data = (await compactImage(screenshot(), 1600, 1100, Infinity))!;
	const dir = mkdtempSync(join(tmpdir(), "image-compact-"));
	writeFileSync(join(dir, "shot.webp"), Buffer.from(data, "base64"));
	const result = await createReadToolDefinition(dir).execute("id", { path: "shot.webp" }, undefined, undefined, undefined as any);
	const again = result.content.find(part => part.type === "image");
	assert.deepEqual([again?.data === data, again?.mimeType], [true, "image/webp"]);
});

test("oversized pasted screenshots are fitted to the model limit; small and undecodable ones stay", async () => {
	const handlers = hooks(), ctx = { model: { inputLimits: { images: { resize: { maxWidth: 1568, maxHeight: 1568 } } } } };
	const out = (await handlers.input({ text: "", images: [image(screenshot(2400, 1650))] }, ctx)).images[0];
	const fitted = decode(out.data);
	assert.deepEqual([fitted.get_width(), fitted.get_height()], [1568, 1078]);
	const small = image(Buffer.from(new photon.PhotonImage(new Uint8Array(200 * 120 * 4).fill(40), 200, 120).get_bytes()));
	const junk = image(Buffer.alloc(200 * 1024, 7));
	assert.deepEqual(await handlers.input({ text: "", images: [small, junk] }, ctx), { action: "continue" });
});

test("compression hooks rewrite images, report saved bytes, and reset the counter each session", async () => {
	const handlers: Record<string, (event: any, ctx: any) => Promise<any>> = {};
	imageCompact({ on: (name: string, handler: any) => { handlers[name] = handler; } } as any);
	assert.deepEqual(Object.keys(handlers).sort(), ["input", "session_start", "tool_result"]);
	const statuses: [string, string | undefined][] = [];
	const ctx = { hasUI: true, model: { inputLimits: {} }, ui: { ...ui, setStatus: (key: string, value: string | undefined) => statuses.push([key, value]) } };
	await handlers.session_start({}, ctx);
	assert.deepEqual(statuses, [["image-compact-saved", undefined]], "nothing shows before any compression");
	const shot = image(screenshot());
	const text = { type: "text" as const, text: "Read image file [image/png]" };

	const result = await handlers.tool_result({ content: [text, shot] }, ctx);
	assert.equal(result.content[0], text);
	assert.equal(result.content[1].mimeType, "image/webp");
	const saved = shot.data.length - result.content[1].data.length;
	assert.deepEqual(statuses.at(-1), ["image-compact-saved", `success:(−${(saved / 1e6).toFixed(1)} MB)`]);
	assert.equal(await handlers.tool_result({ content: [text] }, ctx), undefined);

	const input = await handlers.input({ text: "look", images: [shot] }, ctx);
	assert.equal(input.action, "transform");
	assert.equal(input.text, "look");
	assert.equal(input.images[0].mimeType, "image/webp");
	const total = saved + shot.data.length - input.images[0].data.length;
	assert.deepEqual(statuses.at(-1), ["image-compact-saved", `success:(−${(total / 1e6).toFixed(1)} MB)`]);
	assert.deepEqual(await handlers.input({ text: "no images" }, ctx), { action: "continue" });
	const jpeg = image(screenshot(), "image/jpeg");
	assert.deepEqual(await handlers.input({ text: "photo", images: [jpeg] }, ctx), { action: "continue" });
	assert.equal(statuses.length, 3, "unchanged images do not change the saved counter");

	await handlers.session_start({}, ctx);
	assert.deepEqual(statuses.at(-1), ["image-compact-saved", undefined]);
	await handlers.input({ text: "new session", images: [shot] }, ctx);
	assert.deepEqual(statuses.at(-1), ["image-compact-saved", `success:(−${(saved / 1e6).toFixed(1)} MB)`]);
});

test("non-PNG hooks preserve images without creating workers", async () => {
	const handlers: Record<string, (event: any, ctx: any) => Promise<any>> = {};
	imageCompact({ on: (name: string, handler: any) => { handlers[name] = handler; } } as any);
	let workers = 0;
	const hook = createHook({ init(_id, type) { if (type === "WORKER") workers++; } });
	hook.enable();
	try {
		for (const mimeType of ["image/jpeg", "image/gif", "image/webp"]) {
			const original = image(Buffer.alloc(32), mimeType);
			assert.deepEqual(await handlers.input({ text: "photo", images: [original] }, {}), { action: "continue" });
			assert.equal(await handlers.tool_result({ content: [original], structuredContent: original }, {}), undefined);
		}
		assert.equal(workers, 0);
	} finally { hook.disable(); }
});

test("structured image results follow the matching compacted image without preserving unrelated payloads", async () => {
	const handlers: Record<string, (event: any, ctx: any) => Promise<any>> = {};
	imageCompact({ on: (name: string, handler: any) => { handlers[name] = handler; } } as any);
	const shot = image(screenshot());
	const jpeg = { ...shot, mimeType: "image/jpeg" };
	const content = [{ type: "text", text: "image note" }, jpeg, shot];
	const structuredContent = { ...shot, note: "original read note" };
	const result = await handlers.tool_result({ content, structuredContent }, { model: {}, ui });
	assert.equal(result.content[1], jpeg, "matching bytes with a different MIME type are a different image");
	assert.equal(result.content[2].mimeType, "image/webp");
	assert.ok(result.structuredContent, "the script must receive the compacted image, not fall back to text");
	assert.deepEqual(result.structuredContent, { ...result.content[2], note: "original read note" });
	assert.deepEqual(structuredContent, { ...shot, note: "original read note" }, "do not mutate the original result");
	for (const value of ["plain text", [shot], { ...shot, data: "another image" }, { nested: shot }]) {
		const unrelated = await handlers.tool_result({ content, structuredContent: value }, { model: {}, ui });
		assert.equal(unrelated.structuredContent, undefined, "unknown schemas retain the host's safe drop behavior");
	}
});

test("compaction runs off the main thread, and a burst beyond the worker limit queues and completes", async () => {
	const handlers: Record<string, (event: any, ctx: any) => Promise<any>> = {};
	imageCompact({ on: (name: string, handler: any) => { handlers[name] = handler; } } as any);
	const shot = image(screenshot());
	let ticks = 0, longest = 0, last = performance.now();
	const timer = setInterval(() => { const now = performance.now(); longest = Math.max(longest, now - last); last = now; ticks++; }, 10);
	const result = await handlers.tool_result({ content: Array(6).fill(shot) }, { model: {}, ui });
	clearInterval(timer);
	assert.ok(result.content.every((part: any) => part.mimeType === "image/webp"));
	assert.ok(ticks > 10 && longest < 150, `event loop stalled for ${Math.round(longest)} ms`);
});

test("a worker file replaced while a session runs (another version's reply) keeps the original image", async () => {
	const dir = mkdtempSync(join(import.meta.dirname, "worker-"));
	try {
		copyFileSync(join(import.meta.dirname, "../src/compress.ts"), join(dir, "compress.ts"));
		writeFileSync(join(dir, "compact.ts"), `import { parentPort } from "node:worker_threads";\nparentPort!.postMessage({ type: "image", data: "UklGRg==", mimeType: "image/webp" });\n`);
		const handlers: Record<string, (event: any, ctx: any) => Promise<any>> = {};
		(await import(join(dir, "compress.ts"))).default({ on: (name: string, handler: any) => { handlers[name] = handler; } });
		assert.equal(await handlers.tool_result({ content: [image(screenshot())] }, { model: {}, ui }), undefined, "11-07: a reply of another shape crashed or corrupted sessions");
	} finally { rmSync(dir, { recursive: true }); }
});
