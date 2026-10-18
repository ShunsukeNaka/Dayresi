# 0020. Claude Code の画面確認には Playwright MCP を使う

- 日付: 2026-10-19
- 状態: 採用

## 背景

この開発環境にはブラウザの画面がなく、Claude Code は PR の画面確認（商品を追加して会計するなど）を行えなかった。Playwright のダウンロード済みの Chromium（ヘッドレス）で、最初の画面の静止スクショは撮れることがわかった。操作を伴う確認のために、ブラウザを動かす方法を決める必要があった。また、日本語フォントが Droid Sans Fallback しか入っておらず、実機と文字幅が違う可能性があった。

## 決めたこと

- Claude Code に Playwright MCP（`@playwright/mcp`）を登録し、クリック・入力・スクショをツールとして使う
- 登録はこのリポジトリのローカル設定（`claude mcp add` の local スコープ、`~/.claude.json`）にする。`package.json` には加えない
- ブラウザは追加でダウンロードせず、ダウンロード済みの Chromium を `--executable-path` で指定する。画面サイズはスマホ相当の 390×844 にする
- 日本語フォントとして Noto CJK（`fonts-noto-cjk`）を入れる

登録したコマンド：

```sh
claude mcp add playwright -- npx -y @playwright/mcp@0.0.83 --headless --browser chromium \
  --executable-path ~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
  --viewport-size 390x844 --output-dir /tmp/claude-1000/playwright-mcp
```

## 検討した他の案

- `playwright` を devDependencies に加え、操作手順をスクリプトで書く（手順がリポジトリに残り E2E テストにも使えるが、依存が増える）
- 依存なしのスクリプト（ダウンロード済みの Chromium を Node 標準の WebSocket で CDP 経由で動かす。何も入れないが、手順を書く手間が増え壊れやすい）
- 静止スクショだけにし、操作が要る確認はユーザーが行う

## 理由
