<p align="center"><img src="assets/banner.png" alt="" width="100%"></p>

<p align="center"><b>English</b> · <a href="docs/README.zh-CN.md">简体中文</a> · <a href="docs/README.es.md">Español</a> · <a href="docs/README.ru.md">Русский</a></p>

# pi-image-compact

Keeps image-heavy [Pi](https://github.com/earendil-works/pi) sessions small, so a pile of screenshots no longer ends in a 413 "request too large" error. In a modelled session of 12 large figures, every request stays under 16 MB and the session sends about half the image tokens (182k instead of 373k). On a public test set of 12 screenshots, plots and photos, WebP made the images a third smaller (3.22 → 2.16 MB).

<p align="center"><img src="assets/loop.gif" alt="The same twelve figure reads with and without pi-image-compact" width="100%"></p>

https://github.com/user-attachments/assets/0c29e6ea-4655-4c62-b5bc-14967bd5dcc7

Also on [YouTube](https://youtu.be/WFU_k1zRBbI).

```bash
pi install npm:pi-image-compact
```

Four independent extensions; turn any of them off with `pi config`: [compress](docs/extensions.md#compress) · [budget](docs/extensions.md#budget) · [prune](docs/extensions.md#prune) · [status](docs/extensions.md#status)

<p align="center"><img src="assets/token-savings.png" alt="Image tokens per request and per session, with and without pi-image-compact" width="100%"></p>

## Development

```bash
npm install && npm test
```

## Contributing

I am still learning, so ideas, issues and pull requests are all very welcome.

## License

MIT
