import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_IMAGE_BYTES } from "../shared.ts";
import imageStatus from "../status.ts";

const image = (bytes: number) => ({ type: "image", data: "x".repeat(bytes), mimeType: "image/png" });
const text = (value: string) => ({ type: "text", text: value });
function setup() {
	const handlers: Record<string, (event: any, ctx: any) => unknown> = {};
	const statuses: [string, string | undefined][] = [];
	const colors: [string, string][] = [];
	imageStatus({ on: (name: string, handler: any) => { handlers[name] = handler; } } as any);
	const ctx = { hasUI: true, ui: {
		setStatus: (key: string, value: string | undefined) => { statuses.push([key, value]); },
		theme: { fg: (color: string, value: string) => { colors.push([color, value]); return `<${color}>${value}</${color}>`; } },
	} };
	return { handlers, statuses, colors, ctx };
}

test("counts only user and tool-result images, using base64 bytes without changing messages", () => {
	const { handlers, statuses, colors, ctx } = setup();
	const messages = [
		{ role: "system", content: [image(50)] },
		{ role: "assistant", content: [image(50)] },
		{ role: "user", content: "plain text" },
		{ role: "user", content: [text("look"), image(1_000_000), image(500_000)] },
		{ role: "toolResult", content: [image(400_000), image(300_000), image(200_000), image(100_000)] },
		{ role: "custom", content: [image(50)] },
	];
	const before = structuredClone(messages);
	assert.deepEqual(Object.keys(handlers).sort(), ["context_with_system", "session_start"]);
	assert.equal(handlers.context_with_system({ messages }, ctx), undefined);
	assert.deepEqual(statuses, [["image-compact", "⧉ 6 ▮▯▯▯▯▯▯▯ 2.5/16 MB"]]);
	assert.deepEqual(colors, []);
	assert.deepEqual(messages, before);
});

test("only sizes above 75 percent receive the warning color", () => {
	for (const extra of [0, 1]) {
		const { handlers, statuses, colors, ctx } = setup();
		handlers.context_with_system({ messages: [{ role: "user", content: [image(MAX_IMAGE_BYTES * 0.75 + extra)] }] }, ctx);
		const size = "▮▮▮▮▮▮▯▯ 12.0/16 MB";
		assert.deepEqual(colors, extra ? [["warning", size]] : []);
		assert.equal(statuses[0][1], `⧉ 1 ${extra ? `<warning>${size}</warning>` : size}`);
	}
});

test("clears old status when images leave the context and when a session starts", () => {
	const { handlers, statuses, ctx } = setup();
	handlers.context_with_system({ messages: [{ role: "user", content: [image(100)] }] }, ctx);
	handlers.context_with_system({ messages: [{ role: "user", content: "no images" }] }, ctx);
	assert.deepEqual(statuses.at(-1), ["image-compact", undefined]);
	handlers.context_with_system({ messages: [{ role: "user", content: [image(100)] }] }, ctx);
	handlers.session_start({ reason: "new" }, ctx);
	assert.deepEqual(statuses.at(-1), ["image-compact", undefined]);
});

test("does not touch UI in headless modes", () => {
	const { handlers } = setup();
	const ctx = { hasUI: false, get ui() { return assert.fail("headless context has no UI"); } };
	handlers.session_start({}, ctx);
	handlers.context_with_system({ messages: [{ role: "user", content: [image(100)] }] }, ctx);
});
