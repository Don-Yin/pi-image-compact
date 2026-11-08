import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import pruneSessionImages from "../prune.ts";

const image = { type: "image", data: "A".repeat(4000), mimeType: "image/png" };

test("after a compaction, earlier images leave memory and the file; later appends and reloads still work", () => {
	const dir = mkdtempSync(join(tmpdir(), "image-prune-"));
	const manager = SessionManager.create(dir, dir);
	manager.appendMessage({ role: "user", content: [{ type: "text", text: "look" }, image], timestamp: 1 } as never);
	manager.appendMessage({ role: "assistant", content: [{ type: "toolCall", id: "c1", name: "read", arguments: { path: "/fig/a.png" } }], timestamp: 2 } as never);
	manager.appendMessage({ role: "toolResult", toolCallId: "c1", toolName: "read", content: [{ type: "text", text: "Read image file" }, image], timestamp: 3 } as never);
	const kept = manager.appendMessage({ role: "toolResult", toolCallId: "c2", toolName: "read", content: [image], timestamp: 4 } as never);
	const compaction = manager.appendCompaction("summary", kept, 1000);

	const hooks = new Map<string, Function>();
	pruneSessionImages({ on: (name: string, hook: Function) => hooks.set(name, hook) } as never);
	assert.deepEqual([...hooks.keys()], ["session_compact"]);
	hooks.get("session_compact")!({ compactionEntry: manager.getBranch().find(entry => entry.id === compaction) },
		{ sessionManager: manager, ui: { notify: () => assert.fail("pruning failed") } });

	// Pi's in-memory entries are the pruned ones (guards against getBranch starting to return copies).
	const live = JSON.stringify(manager.getBranch());
	assert.match(live, /\[image removed after compaction\.\]/u, "a pasted image has no path to offer");
	assert.match(live, /\[image removed after compaction\. read \/fig\/a\.png again if you still need it\.\]/u);
	assert.equal(live.match(/"type":"image"/gu)?.length, 1, "the image after the compaction point stays");

	manager.appendMessage({ role: "user", content: "after", timestamp: 5 } as never);
	const file = manager.getSessionFile()!;
	assert.equal(readFileSync(file, "utf8").match(/"type":"image"/gu)?.length, 1, "the file drops the same images");
	const reloaded = SessionManager.open(file, dir);
	assert.equal(reloaded.getBranch().length, manager.getBranch().length, "appends after the swap land in the new file");
});
