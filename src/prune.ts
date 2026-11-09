import { closeSync, openSync, readSync, renameSync, writeSync } from "node:fs";
import { StringDecoder } from "node:string_decoder";
import type { ExtensionAPI, SessionEntry } from "@earendil-works/pi-coding-agent";
import { imageParts, imagePlaceholder, readPaths } from "./shared.ts";

/**
 * Images before a compaction never reach the model again, yet Pi keeps them in the session file
 * and in memory, and re-reads them all at every start.
 * Replaces each with a text placeholder naming its file, in place on Pi's own entries (getBranch
 * returns them, not copies), so memory is freed at once. Returns the ids of the changed entries.
 */
export function pruneImages(branch: SessionEntry[], stopId: string): Set<string> {
	const changed = new Set<string>();
	const before = branch.slice(0, Math.max(0, branch.findIndex(entry => entry.id === stopId)));
	const paths = readPaths(before.flatMap(entry => (entry.type === "message" ? [entry.message] : [])));
	for (const entry of before) {
		if (entry.type !== "message") continue;
		const content = imageParts(entry.message);
		content?.forEach((part, index) => {
			if (part.type !== "image") return;
			content[index] = { type: "text", text: imagePlaceholder("removed after compaction", entry.message, paths) };
			changed.add(entry.id);
		});
	}
	return changed;
}

/** A malformed line has no id; Pi skips such lines on load, so it is copied unchanged. */
function entryId(line: string): string {
	try {
		return (JSON.parse(line) as { id?: string }).id ?? "";
	} catch {
		return "";
	}
}

/**
 * Rewrites the changed entries in the session file and leaves every other line byte-identical.
 * Synchronous, so none of Pi's appends (which reopen the path each time) can land in between;
 * the rename makes the swap atomic and later appends go to the new file.
 */
export function rewriteEntries(file: string, entries: Map<string, SessionEntry>): void {
	const temporary = `${file}.prune-${process.pid}`;
	const input = openSync(file, "r");
	const output = openSync(temporary, "w");
	try {
		const decoder = new StringDecoder("utf8");
		const buffer = Buffer.allocUnsafe(1 << 20);
		let pending = "";
		const write = (line: string) => {
			const replacement = line.includes('"image"') ? entries.get(entryId(line)) : undefined;
			writeSync(output, `${replacement ? JSON.stringify(replacement) : line}\n`);
		};
		for (let read; (read = readSync(input, buffer, 0, buffer.length, null)); ) {
			pending += decoder.write(buffer.subarray(0, read));
			const lines = pending.split("\n");
			pending = lines.pop() ?? "";
			lines.forEach(write);
		}
		pending += decoder.end();
		if (pending) write(pending);
	} finally {
		closeSync(input);
		closeSync(output);
	}
	renameSync(temporary, file);
}

export default function pruneSessionImages(pi: ExtensionAPI) {
	pi.on("session_compact", ({ compactionEntry }, ctx) => {
		const branch = ctx.sessionManager.getBranch();
		const changed = pruneImages(branch, compactionEntry.firstKeptEntryId);
		const file = ctx.sessionManager.getSessionFile();
		if (!changed.size || !file) return;
		try {
			rewriteEntries(file, new Map(branch.filter(entry => changed.has(entry.id)).map(entry => [entry.id, entry])));
		} catch (error) {
			// The file keeps its images; memory is already freed and the next compaction retries.
			ctx.ui.notify(`[image-compact] could not prune the session file: ${(error as Error).message}`, "warning");
		}
	});
}
