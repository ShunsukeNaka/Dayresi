# Dayresi 開発ルール

アプリの概要と仕様は [SPEC.md](SPEC.md)、開発コマンドは [README.md](README.md) を参照。

## 仕様

- 仕様の変更・追加は、実装する前に SPEC.md を更新して合意をとる
- SPEC.md の「必ず守ること」と「MVP で扱わないもの」に反する実装はしない

## ブランチと PR

- `main` に直接コミット・push しない（`main` への push で GitHub Pages に即公開されるため）
- 作業ごとに `main` から機能ブランチを切り、PR を作ってマージする
- コミットメッセージと PR のタイトル・本文は日本語で書く

## コミット前のチェック

- `npm run lint` を通す
- `src/lib` のロジックを変えたら、`src/lib/lib.test.ts` のテストを追加・更新する

## 依存パッケージ

- npm パッケージを追加する前に、理由を示して承認をとる

## 意思決定の記録

- 選択肢を示してユーザーが決めたときは、その場で `docs/decisions/` に ADR を用意し、同じ PR に含める（書き方は [docs/decisions/README.md](docs/decisions/README.md)）
- ADR の「理由」はユーザーが書く。Claude は理由欄を空けておき、ユーザーに記入を頼む（推測で書かない）
- ユーザーが選択肢なしで自分で ADR を追加することもある
- PR の本文から、関係する ADR にリンクする
