import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getImageDimensions } from "@earendil-works/pi-tui";
import { imageParts, imagePlaceholder, MAX_IMAGE_BYTES, type Part, readPaths, TARGET_IMAGE_BYTES } from "./shared.ts";

/**
 * Claude's visual tokens, an estimate for any model: one per 28×28 patch, at most 4,784 per image
 * (Claude 4.7 and later; older models cap at 1,568). Unknown formats count as zero.
 */
export function imageTokens(part: Part): number {
	const size = part.data && part.mimeType ? getImageDimensions(part.data, part.mimeType) : null;
	return size ? Math.min(4784, Math.ceil(size.widthPx / 28) * Math.ceil(size.heightPx / 28)) : 0;
}
const imageKey = (message: AgentMessage, index: number) =>
	`${message.role === "toolResult" ? message.toolCallId : `${message.role}@${message.timestamp}`}:${index}`;

/**
 * Messages with the oldest images replaced by a placeholder, or undefined when nothing changes.
 * `dropped` maps each replaced image to its estimated tokens and persists across requests.
 */
export function limitImageBytes(messages: AgentMessage[], dropped: Map<string, number>, max = MAX_IMAGE_BYTES, target = TARGET_IMAGE_BYTES): AgentMessage[] | undefined {
	const images: { key: string; bytes: number; part: Part }[] = [];
	for (const message of messages)
		imageParts(message)?.forEach((part, index) => {
			const key = imageKey(message, index);
			if (part.type === "image" && !dropped.has(key)) images.push({ key, bytes: part.data?.length ?? 0, part });
		});
	let total = images.reduce((sum, image) => sum + image.bytes, 0);
	if (total > max)
		for (const image of images) {
			if (total <= target) break;
			dropped.set(image.key, imageTokens(image.part));
			total -= image.bytes;
		}
	const paths = readPaths(messages);
	let changed = false;
	const next = messages.map(message => {
		const parts = imageParts(message);
		if (!parts?.some((part, index) => part.type === "image" && dropped.has(imageKey(message, index)))) return message;
		changed = true;
		const placeholder = imagePlaceholder("omitted to keep the request under the provider size limit", message, paths);
		return {
			...message,
			content: parts.map((part, index) =>
				part.type === "image" && dropped.has(imageKey(message, index)) ? { type: "text", text: placeholder } : part),
		} as AgentMessage;
	});
	return changed ? next : undefined;
}

export default function budgetImages(pi: ExtensionAPI) {
	// Keep earlier choices for the session so the request prefix stays cached.
	const dropped = new Map<string, number>();
	pi.on("session_start", (_event, ctx) => {
		dropped.clear();
		if (ctx.hasUI) ctx.ui.setStatus("image-compact-trimmed", undefined);
	});
	pi.on("context_with_system", ({ messages }, ctx) => {
		const before = dropped.size;
		const next = limitImageBytes(messages, dropped);
		if (ctx.hasUI && dropped.size !== before) {
			const tokens = [...dropped.values()].reduce((sum, value) => sum + value, 0);
			ctx.ui.setStatus("image-compact-trimmed", ctx.ui.theme.fg("warning", `${dropped.size} trimmed ≈ ${Math.round(tokens / 1000)}k tok`));
		}
		return next && { messages: next };
	});
}
