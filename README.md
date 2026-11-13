# パラメトロン計算機パズル

**遊ぶ: https://nishio.github.io/parametron-puzzle/**

3入力の多数決から、AND → OR → XOR → 半加算器 → 全加算器を作るパズルです。

回路エディタには[React Flow（@xyflow/react）](https://reactflow.dev/)を使います。
ノード移動、端子からの接続、配線描画、選択・削除、パン、ズーム、ミニマップはReact Flow標準の機能です。
自動整列は[Dagre](https://github.com/dagrejs/dagre)です。自前のドラッグ・配線ルーティング処理はありません。

## 操作

- 出力端子から入力端子へドラッグして接続。端子を順にクリック／タップしても接続できます。
- 素子は小さなSVG記号で表示します。見出し・記号をつかんで移動。背景をドラッグして盤面を移動。
- 「詳細」または素子のダブルクリックで、入力・反転・部品展開の編集カードを開きます。「畳む」で記号に戻ります。回路はそのままです。
- 盤面は画面全体の高さを使います。「説明を畳む」で横幅も広げられます。スマホでは「説明とテスト」で説明パネルを開きます。
- 左下の標準コントロールで拡大・縮小・全体表示。スマホではピンチも使えます。
- 「配置を整える」でDagreが配置します。
- 線を選ぶと、その線と両端の素子を強調します。矢印で向き、入力端子の名前で接続元を確認できます。
- 選んだ線を外すか、選択後Delete／Backspaceで削除。詳細カードの各入力の「反転」で0と1を入れ替えます。
- 説明パネルの入力テストですべての組み合わせを確認できます。

できたAND・OR・XORは部品として再利用でき、「中を開く」で展開できます。
部品を使った場合も、中のパラメトロン数で採点します。反転・定数・分岐は無料です。
全加算器は部品構成9素子でもクリアでき、多数決を直接使えば最少3素子です。
循環する配線は接続時に拒否します。ノードの作成順・画面上の順序は計算結果に影響しません。

進捗・獲得部品・自己ベスト・配置はlocalStorageに保存します。
以前のバージョンの進捗も読み込みます。保存データや回路を外部サービスへ送信する処理はありません。
波形は模式表示で、励振クロックやアナログ過渡現象はシミュレーションしません。

## 開発・検証

Node.js 22.12以降:

```sh
npm ci
npm test
npm run build
npm run test:browser
```

- `editor/src/main.jsx`: React Flowとゲーム画面
- `editor/src/nodes.jsx`: SVG素子・詳細カードとReact Flow標準端子
- `editor/src/engine.js`: 独立した論理シミュレータ・採点・部品展開・保存データの正規化
- `editor/src/style.css`, `editor/src/workspace.css`: 詳細カード・盤面・SVG素子の見た目
- `vite.config.js`: React/Viteの設定
- `docs/`: GitHub Pagesへ配信するビルド結果

GitHub Pagesの配信元は`main`ブランチの`/docs`です。
変更時は`npm run build`を実行し、ソースと生成された`docs`のファイルを一緒にコミットします。
実行時のライブラリはビルドへ同梱するため、CDNやChatGPTの機能に依存しません。

`npm test`は全問題の真理値表、部品展開、保存復元、作成順と独立した計算、循環防止、3素子の下限を検証します。
`npm run test:browser`は、インストール済みのMicrosoft Edgeを独立したヘッドレス環境で使います。
React Flow標準のクリック／タップ接続、SVGと詳細の切り替え、盤面の拡張、配線の選択強調、反転、キーボード・ドラッグ移動、保存復元、自動整列、部品展開、9／3素子の全加算器を実操作で確認します。
ローカルビルドはPlaywrightのリクエスト処理で読み込むため、確認用サーバーや新しいポートは不要です。
`SITE_URL`を指定すれば、公開URLで同じ検証を行います。
画像はGit管理外の`.artifacts/react-flow-review/`へ保存します。

## 原理の資料

- [Eiichi Goto, The Parametron, a Digital Computing Element which Utilizes Parametric Oscillation (1959)](https://ethw-images.s3.us-east-va.perf.cloud.ovh.us/ethw/3/33/Goto_IRE4708.pdf)
- [Amarù et al., Majority Logic Synthesis (2018)](https://msoeken.github.io/papers/2018_iccad.pdf)
