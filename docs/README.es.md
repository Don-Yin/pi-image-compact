<p align="center"><img src="../assets/banner.png" alt="" width="100%"></p>

<p align="center"><a href="../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <b>Español</b> · <a href="README.ru.md">Русский</a> · <a href="README.ja.md">日本語</a></p>

# pi-image-compact

Mantiene pequeñas las sesiones de [Pi](https://github.com/earendil-works/pi) con muchas imágenes, para que un montón de capturas ya no termine en un error 413 "request too large". En una sesión modelada de 12 figuras grandes, cada petición se queda por debajo de 16 MB y la sesión envía más o menos la mitad de tokens de imagen (182k en lugar de 373k). En un conjunto público de 12 capturas, gráficos y fotos, WebP redujo las imágenes un tercio (3.22 → 2.16 MB).

<p align="center"><img src="../assets/loop.gif" alt="The same twelve figure reads with and without pi-image-compact" width="100%"></p>

https://github.com/user-attachments/assets/0c29e6ea-4655-4c62-b5bc-14967bd5dcc7

También en [YouTube](https://youtu.be/WFU_k1zRBbI).

```bash
pi install npm:pi-image-compact
```

Cuatro extensiones independientes; puedes desactivar cualquiera con `pi config` (detalles en inglés): [compress](extensions.md#compress) · [budget](extensions.md#budget) · [prune](extensions.md#prune) · [status](extensions.md#status)

<p align="center"><img src="../assets/token-savings.png" alt="Image tokens per request and per session, with and without pi-image-compact" width="100%"></p>

## Desarrollo

```bash
npm install && npm test
```

## Contribuir

Todavía estoy aprendiendo, así que cualquier idea, issue o pull request es muy bienvenido.

## Licencia

MIT
