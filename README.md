# Dayresi

登録不要・その日だけ使える Web レジ。データはブラウザ内にだけ保存され、サーバーは持ちません。

仕様は [SPEC.md](SPEC.md) を参照してください。

## 使い方

1. 「設定」で商品（名前と税込価格）を登録する。別の端末で準備した場合は「ファイルを読み込む」で商品設定ファイルを取り込む
2. 「レジ」で商品を選び、「会計」でお預かり金額を入力して確定する
3. 終了時は「集計」で売上を確認し、「売上CSVを保存」でファイルに残す

## 開発

Node.js 24 が必要です。

```sh
npm install
npm run dev      # 開発サーバー
npm test         # ロジックのテスト
npm run build    # dist/ に静的ファイルを出力
npm run preview  # ビルド結果の確認（オフライン動作もここで確認できる）
```

## 公開（GitHub Pages）

1. GitHub にリポジトリを作って `main` ブランチを push する
2. リポジトリの Settings → Pages → Build and deployment の Source を「GitHub Actions」にする
3. 以降は `main` に push するたびに `.github/workflows/deploy.yml` がテスト・ビルド・公開を行う

`base: './'` にしているので、リポジトリ名を変えても設定変更は不要です。
