# 意思決定の記録（ADR）

あとで「なぜこうしたのか」を見返せるように、判断の経緯をここに残す。

## 書き方

- 判断1件につき1ファイル。ファイル名は `連番4桁-英語の短い名前.md`
- 下のテンプレートをコピーして書く
- 一度書いた内容は書き換えない。方針を変えるときは新しい ADR を作り、古いほうの「状態」を「NNNN で置き換え」にする
- 記録するのは、あとで理由を思い出せなくなりそうなもの（仕様の範囲、技術選定、データ形式、UI の大きな方針、開発の進め方など）

## テンプレート

```markdown
# NNNN. タイトル

- 日付: YYYY-MM-DD
- 状態: 採用

## 背景

何を決める必要があったか。

## 決めたこと

## 検討した他の案

## 理由
```

## 一覧

| 番号 | タイトル | 状態 |
|---|---|---|
| [0001](0001-record-decisions-as-adr.md) | 意思決定を ADR で記録する | 採用 |
| [0002](0002-rules-in-claude-md.md) | 開発ルールを CLAUDE.md に置く | 採用 |
| [0003](0003-feature-branch-and-pr.md) | main に直接 push せず、機能ブランチと PR で進める | 採用 |
| [0004](0004-pre-commit-checks.md) | コミット前のチェックは lint とテストの追加・更新にする | 採用 |
| [0005](0005-update-spec-first.md) | 仕様の変更は実装前に SPEC.md を更新する | 採用 |
| [0006](0006-japanese-commits-and-prs.md) | コミットメッセージと PR は日本語で書く | 採用 |
| [0007](0007-approve-new-dependencies.md) | npm パッケージの追加は事前に承認をとる | 採用 |
| [0008](0008-purpose-in-readme.md) | プロダクトの目的を README.md にまとめる | 採用 |
| [0009](0009-new-design-in-pen.md) | デザインファイルは pen.dev で新しいデザイン案として作る | 採用 |
| [0010](0010-user-journey-in-docs-research.md) | ユーザージャーニーマップは docs/research/ に Markdown で置く | 採用 |
| [0011](0011-allow-negative-price.md) | 商品の価格をマイナスにもできるようにする | 採用 |
| [0012](0012-keep-void-as-is.md) | 会計の間違いは今の取消のままで直す | 採用 |
| [0013](0013-main-and-sub-targets.md) | 届けたい人は、用意する人をメイン、接客する人をサブのターゲットにする | 採用 |
| [0014](0014-mvp-done-criteria.md) | MVP の完了条件は、見直した SPEC の通りに公開されていることにする | 採用 |
| [0015](0015-no-sales-only-reset.md) | 商品を残したまま売上だけを消去する機能は MVP で扱わない | 採用 |
| [0016](0016-cart-clear-only.md) | カートの削除は、一括のクリアだけにする | 採用 |
| [0017](0017-no-expense-profit.md) | 経費の記録・利益の計算を「MVP で扱わないもの」に書く | 採用 |
| [0018](0018-cash-only-payment.md) | 支払方法は分けず、現金と同じように記録する | 採用 |
| [0019](0019-school-festival-only.md) | 利用シーンを文化祭の模擬店に絞る | 採用 |
| [0020](0020-playwright-mcp-for-screen-check.md) | Claude Code の画面確認には Playwright MCP を使う | 採用 |
| [0021](0021-issue-driven-development.md) | Issue 駆動で開発する | 採用 |
| [0022](0022-rebuild-mvp.md) | MVP を作り直す | 採用 |
| [0023](0023-decisions-in-issues.md) | Issue の作業中に決めたことは、その Issue にも書く | 採用 |
| [0024](0024-rebuild-layer-by-layer.md) | 作り直しは、層ごとに今のコードを置き換えて進める | 採用 |
| [0025](0025-rethink-data-formats.md) | データの形式は、今の形式との互換を前提にせずに考え直す | 採用 |
