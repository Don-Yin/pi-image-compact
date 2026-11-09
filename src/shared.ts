import type { AgentMessage } from "@earendil-works/pi-agent-core";

/**
 * Base64 image bytes allowed in one request. Token-based compaction does not see bytes: twelve
 * 2000×2000 figure reads (33.5 MB) got a 413 "request too large" at about 100K tokens. Above the limit, the oldest images become text down to the target, and stay text,
 * so the request prefix changes rarely rather than on every new image.
 */
export const MAX_IMAGE_BYTES = 16_000_000;
export const TARGET_IMAGE_BYTES = 8_000_000;

export type Part = { type: string; data?: string; mimeType?: string; text?: string };

/** The parts of a message that can carry images (user input or a tool result), else undefined. */
export const imageParts = (message: AgentMessage): Part[] | undefined =>
	(message.role === "user" || message.role === "toolResult") && Array.isArray(message.content) ? (message.content as Part[]) : undefined;

/** The one text an image in `message` becomes; a `read` path lets the model read the file again. */
export function imagePlaceholder(reason: string, message: AgentMessage, paths: Map<string, string>): string {
	const path = message.role === "toolResult" ? paths.get(message.toolCallId) : undefined;
	return `[image ${reason}.${path ? ` read ${path} again if you still need it.` : ""}]`;
}

/** Paths of `read` tool calls by call id, so an image tool result can name its file. */
export function readPaths(messages: AgentMessage[]): Map<string, string> {
	const paths = new Map<string, string>();
	for (const message of messages)
		if (message.role === "assistant")
			for (const block of message.content)
				if (block.type === "toolCall" && block.name === "read" && typeof block.arguments?.path === "string")
					paths.set(block.id, block.arguments.path);
	return paths;
}
