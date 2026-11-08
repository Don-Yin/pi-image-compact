import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { Worker } from "node:worker_threads";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getImageDimensions } from "@earendil-works/pi-tui";

// Images below this size cost little; they pass through untouched.
const MIN_BYTES = 100 * 1024;
// Each worker peaks around 120 MB on a large screenshot, so a burst of attachments runs a few at a time.
const MAX_WORKERS = 4;

function runWorker(png: Uint8Array, width: number, height: number, maxBytes: number): Promise<string | undefined> {
	return new Promise(resolve => {
		const worker = new Worker(new URL("./compact.ts", import.meta.url), { workerData: { png, width, height, maxBytes } });
		// The worker file loads from disk per image, so a running session may meet a newer worker: accept only its base64 string.
		worker.once("message", (data: unknown) => resolve(typeof data === "string" ? data : undefined));
		worker.once("error", () => resolve(undefined));
		worker.once("exit", () => resolve(undefined));
	});
}

/**
 * The PNG file behind a `read` image that Pi resized (and usually turned into JPEG), when its aspect ratio
 * matches the delivered width×height; Pi only scales, so anything else is not the same picture.
 */
async function sourcePng(path: string, width: number, height: number): Promise<Buffer | undefined> {
	const file = await readFile(path).catch(() => undefined);
	if (!file || file.length < 24 || file.readUInt32BE(0) !== 0x89504e47) return;
	return Math.abs((file.readUInt32BE(20) * width) / file.readUInt32BE(16) - height) <= 1 ? file : undefined;
}

const unlessSame = <T>(before: T[], after: T[]) => (after.some((part, i) => part !== before[i]) ? after : undefined);

export default function compressImages(pi: ExtensionAPI) {
	let saved = 0, active = 0;
	const waiting: Array<() => void> = [];
	// One short-lived worker per image, like Pi's own image resizing; any failure keeps the original.
	async function compact(image: ImageContent, ctx: ExtensionContext, path?: string): Promise<ImageContent> {
		const bytes = Buffer.byteLength(image.data, "base64");
		const size = bytes >= MIN_BYTES ? getImageDimensions(image.data, image.mimeType) : null;
		if (!size) return image;
		const { maxWidth = 2000, maxHeight = 2000 } = ctx.model?.inputLimits?.images?.resize ?? {};
		const scale = Math.min(1, maxWidth / size.widthPx, maxHeight / size.heightPx);
		const width = Math.round(size.widthPx * scale), height = Math.round(size.heightPx * scale);
		const png = image.mimeType === "image/png" ? Buffer.from(image.data, "base64") : path && (await sourcePng(path, width, height));
		if (!png) return image;
		if (active < MAX_WORKERS) active++;
		else await new Promise<void>(resolve => waiting.push(resolve));
		try {
			const data = await runWorker(png, width, height, bytes);
			if (!data) return image;
			saved += image.data.length - data.length;
			if (ctx.hasUI) ctx.ui.setStatus("image-compact-saved", ctx.ui.theme.fg("success", `(−${(saved / 1e6).toFixed(1)} MB)`));
			return { type: "image", data, mimeType: "image/webp" };
		} finally {
			const next = waiting.shift();
			if (next) next(); // hand the slot straight to the next image
			else active--;
		}
	}
	pi.on("session_start", (_event, ctx) => {
		saved = 0;
		if (ctx.hasUI) ctx.ui.setStatus("image-compact-saved", undefined);
	});
	pi.on("tool_result", async (event, ctx) => {
		const input = event.input as { path?: unknown };
		const path = event.toolName === "read" && typeof input?.path === "string"
			? resolve(ctx.cwd, input.path.replace(/^@/, "").replace(/^~(?=$|\/)/, homedir()))
			: undefined;
		const next: (TextContent | ImageContent)[] = await Promise.all(
			event.content.map(part => (part.type === "image" ? compact(part, ctx, path) : part)),
		);
		const content = unlessSame(event.content, next);
		if (!content) return;
		const value = event.structuredContent;
		if (value && typeof value === "object" && "type" in value && value.type === "image") {
			const index = event.content.findIndex(part => part.type === "image" && part.data === value.data && part.mimeType === value.mimeType);
			const image = content[index];
			if (image?.type === "image") return { content, structuredContent: { ...value, ...image } };
		}
		return { content };
	});
	pi.on("input", async (event, ctx) => {
		if (!event.images) return { action: "continue" };
		const images = unlessSame(event.images, await Promise.all(event.images.map(image => compact(image, ctx))));
		return images ? { action: "transform", text: event.text, images } : { action: "continue" };
	});
}
