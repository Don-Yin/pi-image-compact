<p align="center"><img src="assets/banner.png" alt="" width="100%"></p>

<p align="center"><b>English</b> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.es.md">Español</a></p>

# pi-image-compact

Keeps image-heavy [Pi](https://github.com/earendil-works/pi) sessions small, so a pile of screenshots no longer ends in a 413 "request too large" error.

```bash
pi install npm:pi-image-compact
```

Four independent extensions; turn any of them off with `pi config`:

| Extension | What it does |
| --- | --- |
| `compress.ts` | Re-encodes PNG images as near-lossless WebP, kept only when smaller and its worst 32×32 tile stays at or above 40 dB PSNR. |
| `budget.ts` | When a request's images pass 16 MB, replaces the oldest with a short note naming the file, until 8 MB remains. Pi can read the file again. |
| `prune.ts` | After a compaction, removes the images the model can no longer see from memory and the session file. |
| `status.ts` | Shows the images in context in the footer, e.g. `⧉ 2 ▮▮▮▯▯▯▯▯ 6.1/16 MB`. |

## Development

```bash
npm install && npm test
```

## Contributing

I am still learning, so if you see a better way to do any of this, please open an issue or send a pull request. Thank you.

## License

MIT
