# パラメトロン計算機パズル

3入力の多数決素子をつないで、指定された真理値表を実現するパズル。

**遊ぶ: https://nishio.github.io/parametron-puzzle/**

多数決を観察する解説から始まり、AND → OR → XOR → 半加算器 → 全加算器へ進みます。
入力を切り替えると各素子の出力と逆位相の波形が変わります。
波形は模式表示で、励振クロックやアナログ過渡現象のシミュレーションは行いません。

作ったAND・OR・XORは部品として再利用でき、「展開」で内部の配線を編集できます。
部品を使った場合も、中にあるパラメトロンの数で採点します。
分岐・定数0/1・反転配線は無料です。
全加算器は9素子の部品構成でもクリアでき、直接の多数決回路なら3素子まで減らせます。

進捗と自己ベストは、そのブラウザのlocalStorageに保存します。サーバーへの送信はありません。

## ファイル

- `index.html`: ページの構造
- `app.js`: 論理シミュレータ、部品の展開、問題、操作と進捗保存
- `style.css`: ゲームの図とレイアウト
- `base.css`: 基本スタイル
- `.nojekyll`: GitHub Pagesで静的ファイルをそのまま配信する設定

ビルド不要です。GitHub Pagesは`main`ブランチのルートから配信します。
実行時に外部ライブラリ、ネットワークAPI、ChatGPTの機能は使いません。

## 検証

Node.js 18以降で:

```sh
npm ci
npm test
```

全問題の真理値表、部品の展開と素子数、配線の削除・共有・反転、保存した進捗の復元を検証します。
DOM上で導入から全加算器まで実際に操作するテストも含みます。
XORおよび全加算器の下位ビットについては、2素子以下の全構成を列挙し、3素子が必要であることを確認します。

## 原理の資料

- [Eiichi Goto, The Parametron, a Digital Computing Element which Utilizes Parametric Oscillation (1959)](https://ethw-images.s3.us-east-va.perf.cloud.ovh.us/ethw/3/33/Goto_IRE4708.pdf)
- [Amarù et al., Majority Logic Synthesis (2018)](https://msoeken.github.io/papers/2018_iccad.pdf)
