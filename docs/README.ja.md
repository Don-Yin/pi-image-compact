<p align="center"><img src="../assets/banner.png" alt="" width="100%"></p>

<p align="center"><a href="../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a> · <b>日本語</b></p>

# pi-image-compact

画像の多い [Pi](https://github.com/earendil-works/pi) セッションを小さく保ち、スクリーンショットが積み重なっても 413「request too large」エラーで終わらないようにします。大きな図 12 枚を読み込むモデル化したセッションでは、どのリクエストも 16 MB 未満に収まり、セッション全体で送る画像トークンはほぼ半分になりました（373k ではなく 182k）。スクリーンショット・グラフ・写真 12 枚の公開テストセットでは、WebP で画像が 3 分の 1 小さくなりました（3.22 → 2.16 MB）。

<p align="center"><img src="../assets/loop.gif" alt="The same twelve figure reads with and without pi-image-compact" width="100%"></p>

https://github.com/user-attachments/assets/b0d5654c-c6a1-4b85-a23a-dcf7adc2e0d2

[YouTube](https://youtu.be/WFU_k1zRBbI) でも見られます。

```bash
pi install npm:pi-image-compact
```

互いに独立した 4 つの拡張機能で、どれも `pi config` で個別にオフにできます（説明は英語）： [compress](extensions.md#compress) · [budget](extensions.md#budget) · [prune](extensions.md#prune) · [status](extensions.md#status)

<p align="center"><img src="../assets/token-savings.png" alt="Image tokens per request and per session, with and without pi-image-compact" width="100%"></p>

## 開発

```bash
npm install && npm test
```

## コントリビュート

まだ勉強中なので、アイデアや issue、pull request を大歓迎します。

## ライセンス

MIT
