<p align="center"><img src="assets/banner.png" alt="" width="100%"></p>

<p align="center"><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.es.md">Español</a> · <b>Русский</b></p>

# pi-image-compact

Сохраняет сессии [Pi](https://github.com/earendil-works/pi) с большим количеством изображений компактными, чтобы гора скриншотов больше не заканчивалась ошибкой 413 "request too large". В смоделированной сессии из 12 больших изображений каждый запрос остаётся меньше 16 MB, а сессия отправляет примерно вдвое меньше токенов изображений (182k вместо 373k). На открытом наборе из 12 скриншотов, графиков и фотографий WebP уменьшил изображения на треть (3.22 → 2.16 MB).

<p align="center"><img src="assets/loop.gif" alt="The same twelve figure reads with and without pi-image-compact" width="100%"></p>

```bash
pi install npm:pi-image-compact
```

Четыре независимых расширения, каждое можно отключить в `pi config` (описание на английском): [compress](docs/extensions.md#compress) · [budget](docs/extensions.md#budget) · [prune](docs/extensions.md#prune) · [status](docs/extensions.md#status)

<p align="center"><img src="assets/token-savings.png" alt="Image tokens per request and per session, with and without pi-image-compact" width="100%"></p>

## Разработка

```bash
npm install && npm test
```

## Участие

Я ещё учусь, поэтому буду очень рад любым идеям, issue и pull request.

## Лицензия

MIT
