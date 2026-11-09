import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { imageParts, MAX_IMAGE_BYTES } from "./shared.ts";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.hasUI) ctx.ui.setStatus("image-compact", undefined);
	});
	pi.on("context_with_system", ({ messages }, ctx) => {
		if (!ctx.hasUI) return;
		let count = 0, bytes = 0;
		for (const message of messages)
			for (const part of imageParts(message) ?? [])
				if (part.type === "image") {
					count++;
					bytes += part.data?.length ?? 0;
				}
		if (!count) return ctx.ui.setStatus("image-compact", undefined);
		// Eight cells like the context bar: how far the images are from the trim limit.
		const filled = Math.min(8, Math.round((bytes / MAX_IMAGE_BYTES) * 8));
		const size = `${"▮".repeat(filled)}${"▯".repeat(8 - filled)} ${(bytes / 1e6).toFixed(1)}/${MAX_IMAGE_BYTES / 1e6} MB`;
		ctx.ui.setStatus("image-compact", `⧉ ${count} ${bytes > MAX_IMAGE_BYTES * 0.75 ? ctx.ui.theme.fg("warning", size) : size}`);
	});
}
