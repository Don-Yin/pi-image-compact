import assert from "node:assert/strict";
import { test } from "node:test";
import budgetImages, { imageTokens, limitImageBytes } from "../budget.ts";

const image = (size: number) => ({ type: "image", data: "x".repeat(size), mimeType: "image/png" });
const read = (id: string, path: string) => ({ role: "assistant", content: [{ type: "toolCall", id, name: "read", arguments: { path } }] });
const result = (id: string, size: number) => ({ role: "toolResult", toolCallId: id, content: [{ type: "text", text: "Read image file" }, image(size)] });

test("oldest images become placeholders down to the target, and stay dropped on later requests", () => {
	const dropped = new Map<string, number>();
	const messages = [
		{ role: "user", timestamp: 1, content: [{ type: "text", text: "see" }, image(30)] },
		read("a", "/fig/a.png"), result("a", 30),
		read("b", "/fig/b.png"), result("b", 30),
	];
	assert.equal(limitImageBytes(messages as never, dropped, 100, 50), undefined, "under the limit nothing changes");

	messages.push(read("c", "/fig/c.png"), result("c", 30));
	const next = limitImageBytes(messages as never, dropped, 100, 50) as typeof messages;
	assert.deepEqual(next[0].content[1], { type: "text", text: "[image omitted to keep the request under the provider size limit.]" });
	assert.deepEqual(next[2].content[1], { type: "text", text: "[image omitted to keep the request under the provider size limit. read /fig/a.png again if you still need it.]" });
	assert.equal(next[4].content[1].type, "text", "120 bytes drop to the 50-byte target, not just under the 100-byte limit");
	assert.equal(next[6].content[1].type, "image");
	assert.equal(messages[0].content[1].type, "image", "the stored messages are not mutated");

	messages.push({ role: "user", timestamp: 2, content: [{ type: "text", text: "small" }, image(10)] } as never);
	const later = limitImageBytes(messages as never, dropped, 100, 50) as typeof messages;
	assert.deepEqual(later.map(message => message.content?.[1]?.type), ["text", undefined, "text", undefined, "text", undefined, "image", "image"],
		"a new image under the limit leaves earlier choices unchanged");
});

test("token estimate follows Claude's 28-pixel patches and per-image cap", () => {
	const png = (width: number, height: number) => {
		const header = Buffer.alloc(24);
		Buffer.from([0x89, 0x50, 0x4e, 0x47]).copy(header);
		header.writeUInt32BE(width, 16);
		header.writeUInt32BE(height, 20);
		return { type: "image", mimeType: "image/png", data: header.toString("base64") };
	};
	assert.equal(imageTokens(png(1000, 1000)), 1296, "Anthropic's table: 1000×1000 is 1,296 tokens");
	assert.equal(imageTokens(png(4000, 4000)), 4784);
	assert.equal(imageTokens({ type: "image", mimeType: "image/png", data: "x" }), 0);
});

test("standalone budget hook keeps the system prompt, enforces 16/8 MB, and resets dropped images per session", () => {
	const handlers: Record<string, (event: any, ctx: any) => any> = {};
	budgetImages({ on: (name: string, handler: any) => { handlers[name] = handler; } } as any);
	const statuses: (string | undefined)[] = [];
	const ctx = { hasUI: true, ui: { setStatus: (_key: string, value?: string) => statuses.push(value), theme: { fg: (_color: string, value: string) => value } } };
	assert.deepEqual(Object.keys(handlers).sort(), ["context_with_system", "session_start"]);
	const system = { role: "system", content: "keep this prompt", timestamp: 0 };
	const messages = [system, read("a", "/a.png"), result("a", 9_000_000), read("b", "/b.png"), result("b", 4_000_000),
		read("c", "/c.png"), result("c", 4_000_000), read("d", "/d.png"), result("d", 2_000_000)];
	const under = messages.slice(0, 5);
	assert.equal(handlers.context_with_system({ messages: under }, ctx), undefined);
	assert.deepEqual(statuses, [], "nothing trimmed, nothing shown");
	const next = handlers.context_with_system({ messages }, ctx).messages;
	assert.deepEqual(statuses, ["2 trimmed ≈ 0k tok"], "fake image data has no readable size");
	assert.equal(next[0], system);
	assert.deepEqual([2, 4, 6, 8].map(index => next[index].content[1].type), ["text", "text", "image", "image"],
		"19 MB drops to 6 MB, not merely the 10 MB left after the oldest image");
	assert.equal(handlers.context_with_system({ messages: under }, ctx).messages[2].content[1].type, "text", "choices persist below the limit");
	assert.equal(statuses.length, 1, "status changes only when more images are trimmed");
	handlers.session_start({}, ctx);
	assert.equal(statuses.at(-1), undefined);
	assert.equal(handlers.context_with_system({ messages: under }, ctx), undefined, "a new session starts with no dropped images");
});
