<p align="center"><img src="assets/banner.png" alt="" width="100%"></p>

<p align="center"><a href="README.md">English</a> · <b>简体中文</b> · <a href="README.es.md">Español</a></p>

# pi-image-compact

让图片很多的 [Pi](https://github.com/earendil-works/pi) 会话保持小巧，截图再多也不会以 413 "request too large" 错误收场。

<p align="center"><img src="assets/loop.gif" alt="The same twelve figure reads with and without pi-image-compact" width="100%"></p>

```bash
pi install npm:pi-image-compact
```

包含四个相互独立的扩展，每个都可以在 `pi config` 里单独关闭：

| 扩展 | 作用 |
| --- | --- |
| `compress.ts` | 把 PNG 图片重新编码为近无损 WebP；只有文件变小、且最差的 32×32 小块 PSNR 不低于 40 dB 时才替换。 |
| `budget.ts` | 一次请求里的图片超过 16 MB 时，把最旧的图片换成一条写明文件名的简短说明，直到剩下 8 MB。Pi 随时可以重新读取原文件。 |
| `prune.ts` | 压缩上下文（compaction）之后，把模型已经看不到的图片从内存和会话文件中删掉。 |
| `status.ts` | 在底栏显示上下文里的图片，例如 `⧉ 2 ▮▮▮▯▯▯▯▯ 6.1/16 MB`。 |

每次请求和整个会话的图片 token，按那次 413 会话推算（每张图 2.8 MB、4,784 token）：

<p align="center"><img src="assets/token-savings.png" alt="Image tokens per request and per session, with and without pi-image-compact" width="100%"></p>

## 开发

```bash
npm install && npm test
```

## 参与贡献

我还在学习，如果你有更好的做法，欢迎提 issue 或发 pull request。谢谢！

## 许可证

MIT
