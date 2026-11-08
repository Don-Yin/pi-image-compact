// Image codec for image-compact. Runs as a worker thread (WASM work would otherwise block Pi's event loop);
// the functions are exported for tests.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { isMainThread, parentPort, workerData } from "node:worker_threads";
import encode, { init } from "@jsquash/webp/encode.js";
import photon, { type PhotonImage } from "@silvia-odwyer/photon-node";

// Worst 32x32 tile must stay above this PSNR, so damage to a line of small text cannot hide behind flat UI chrome.
const MIN_TILE_PSNR = 40;
const TILE = 32;
// Near-lossless WebP: on real screenshots about a quarter of Pi's PNG, worst tile about 47 dB.
const WEBP = { lossless: 1, near_lossless: 60, method: 4 };

// Node supports WASM SIMD, so the encoder loads its SIMD glue; hand it the matching binary.
let encoder: ReturnType<typeof init> | undefined;
const encoderReady = () =>
	(encoder ??= init(new WebAssembly.Module(readFileSync(createRequire(import.meta.url).resolve("@jsquash/webp/codec/enc/webp_enc_simd.wasm")))));

export function worstTilePsnr(a: Uint8Array, b: Uint8Array, width: number, height: number): number {
	let worst = 0;
	for (let ty = 0; ty < height; ty += TILE) {
		for (let tx = 0; tx < width; tx += TILE) {
			let sum = 0, n = 0;
			for (let y = ty; y < Math.min(ty + TILE, height); y++) {
				for (let i = (y * width + tx) * 4, end = (y * width + Math.min(tx + TILE, width)) * 4; i < end; i++, n++) {
					const d = a[i] - b[i];
					sum += d * d;
				}
			}
			worst = Math.max(worst, sum / n);
		}
	}
	return worst === 0 ? Infinity : 10 * Math.log10((255 * 255) / worst);
}

/**
 * Near-lossless WebP of a PNG resized to width×height, as base64, when it is under maxBytes and its worst tile
 * passes the gate against those resized pixels; otherwise undefined. The PNG may be the file behind Pi's resized
 * JPEG, so the model gets an image of the same size without JPEG's damage around small text.
 */
export async function compactImage(png: Uint8Array, width: number, height: number, maxBytes: number): Promise<string | undefined> {
	let source: PhotonImage | undefined, sized: PhotonImage | undefined;
	try {
		source = photon.PhotonImage.new_from_byteslice(png);
		sized = source.get_width() === width && source.get_height() === height
			? source : photon.resize(source, width, height, photon.SamplingFilter.Lanczos3);
		const pixels = sized.get_raw_pixels();
		await encoderReady();
		const webp = new Uint8Array(await encode({ data: new Uint8ClampedArray(pixels), width, height, colorSpace: "srgb" }, WEBP));
		if (webp.length >= maxBytes) return;
		const decoded = photon.PhotonImage.new_from_byteslice(webp);
		const psnr = worstTilePsnr(pixels, decoded.get_raw_pixels(), width, height);
		decoded.free();
		return psnr >= MIN_TILE_PSNR ? Buffer.from(webp).toString("base64") : undefined;
	} catch {
		return;
	} finally {
		if (sized !== source) sized?.free();
		source?.free();
	}
}

if (!isMainThread && parentPort) {
	const { png, width, height, maxBytes } = workerData;
	parentPort.postMessage((await compactImage(png, width, height, maxBytes)) ?? null);
}
