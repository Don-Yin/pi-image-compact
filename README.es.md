<p align="center"><img src="assets/banner.png" alt="" width="100%"></p>

<p align="center"><a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <b>Español</b></p>

# pi-image-compact

Mantiene pequeñas las sesiones de [Pi](https://github.com/earendil-works/pi) con muchas imágenes, para que un montón de capturas de pantalla ya no termine en un error 413 "request too large".

<p align="center"><img src="assets/loop.gif" alt="The same twelve figure reads with and without pi-image-compact" width="100%"></p>

```bash
pi install npm:pi-image-compact
```

Cuatro extensiones independientes; puedes desactivar cualquiera de ellas con `pi config`:

| Extensión | Qué hace |
| --- | --- |
| `compress.ts` | Vuelve a codificar las imágenes PNG como WebP casi sin pérdida, y solo las sustituye si el archivo es más pequeño y su peor bloque de 32×32 se mantiene en 40 dB de PSNR o más. |
| `budget.ts` | Cuando las imágenes de una petición superan 16 MB, sustituye las más antiguas por una nota breve con el nombre del archivo, hasta que quedan 8 MB. Pi puede volver a leer el archivo. |
| `prune.ts` | Después de una compactación, elimina de la memoria y del archivo de sesión las imágenes que el modelo ya no puede ver. |
| `status.ts` | Muestra en la barra inferior las imágenes del contexto, por ejemplo `⧉ 2 ▮▮▮▯▯▯▯▯ 6.1/16 MB`. |

Tokens de imagen por petición y por sesión, modelados sobre la sesión del 413 (2.8 MB y 4.784 tokens por figura):

<p align="center"><img src="assets/token-savings.png" alt="Image tokens per request and per session, with and without pi-image-compact" width="100%"></p>

## Desarrollo

```bash
npm install && npm test
```

## Contribuir

Todavía estoy aprendiendo, así que si ves una forma mejor de hacer algo de esto, abre un issue o envía un pull request. ¡Gracias!

## Licencia

MIT
