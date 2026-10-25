# 0029. 選んだ技術のメリットを docs/tech-choices.md に書き足していく

- 日付: 2026-10-25
- 状態: 採用

## 背景

#51 で商品の ID の振り方（`crypto.randomUUID()`）を決めたとき、ユーザーから「選んだ技術のメリット、なぜほかの技術ではないのかを、同じファイルに書き足していってほしい」と頼まれた。置き場所と、書き忘れない仕組みを決める必要があった。

## 決めたこと

- 選んだ技術ごとに、メリットと、ほかの案を選ばなかった理由を `docs/tech-choices.md` に書く。Claude が書く
- 技術を選んだら、同じ PR で書き足す。このルールを CLAUDE.md に書く
- すでに使っている技術（Vite、React、TypeScript、localStorage、PWA、Vitest、oxlint、GitHub Pages）は、今は書かない

## 検討した他の案

- `docs/tech-choices.md` だけ作り、CLAUDE.md は変えない
- 技術を選ぶたびに ADR を 1 件足す
- すでに使っている技術の分も、別の Issue でまとめて書く

## 理由
