# Extensions

pi-image-compact is four independent extensions. Each one can be turned off on its own with `pi config`.

## compress

`compress.ts` makes each image Pi reads smaller in bytes.

- Pi resizes a large PNG to 2000 px and usually sends it as JPEG. JPEG blurs text, so this extension goes back to the original PNG instead of recompressing the JPEG.
- It re-encodes the PNG at the same size as near-lossless WebP.
- The WebP replaces Pi's image only when it is smaller and its worst 32×32 tile stays at or above 40 dB PSNR. Otherwise Pi's image is kept.
- Images under 100 KB are left alone.

WebP saves bytes, not tokens: the model still sees the same number of pixels.

## budget

`budget.ts` keeps every request under the provider's size limit.

- When the images in one request pass 16 MB, the oldest are replaced with a short note naming their file, until 8 MB remains.
- The model can read the file again whenever it needs it.
- A replaced image stays replaced for the rest of the session, so the start of each request does not change and the prompt cache keeps working.

## prune

`prune.ts` keeps the session file light.

- After a compaction, images from before it never reach the model again, yet Pi keeps them in memory and in the session file, and reads them all back at every start.
- This extension replaces each of them with a placeholder naming its file, in memory and in the session file. Every other line of the file stays byte-identical.

## status

`status.ts` shows the images in context in Pi's footer:

```text
⧉ 2 ▮▮▮▯▯▯▯▯ 6.1/16 MB (−8.0 MB) 10 trimmed ≈ 17k tok
```

| Part | Meaning |
| --- | --- |
| `⧉ 2` | images in the current request |
| `▮▮▮▯▯▯▯▯ 6.1/16 MB` | their size against the 16 MB limit |
| `(−8.0 MB)` | bytes saved by compress |
| `10 trimmed` | images budget replaced with a note |
| `≈ 17k tok` | estimated image tokens those notes saved |

The token estimate uses Claude's rule: one token per 28×28 patch, at most 4,784 per image.
