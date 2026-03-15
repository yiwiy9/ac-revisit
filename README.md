# ac-revisit

AtCoder 上で動作する Tampermonkey 向け userscript です。  
復習対象として登録した問題から、14 日経過した問題を「今日の一問」として 1 問ずつ提案します。

## 必要環境

- Node.js 18 以上
- npm
- Tampermonkey

## セットアップ

```bash
npm install
```

`npm install` 時に `prepare` が実行され、`husky` のフックが有効化されます。`pre-commit` では `lint-staged`（ステージ済みファイルのみ整形+lint）を実行し、`pre-push` では `npm run verify` を実行します。

## 開発フロー（コピペ不要）

1. 開発サーバー起動

```bash
npm run dev
```

2. Tampermonkey で次の URL を 1 回インストール

```text
http://127.0.0.1:4310/ac-revisit.dev.user.js
```

3. 以後はコード変更ごとに自動再ビルドされるので、AtCoder ページを再読み込みして確認

補足:

- `127.0.0.1` 固定は IPv4/IPv6 解決差異を避けるためです。
- ポート変更が必要なら `PORT=xxxx npm run dev` を使えます。
- `npm run dev` のたびに dev 用 `@version` が自動更新されるため、Tampermonkey の「更新を確認」で反映できます。

## 検証コマンド

```bash
# lint + typecheck + test
npm run verify

# format check
npm run format:check

# 自動整形
npm run format

# ステージ済みファイルのみ整形+lint（pre-commit と同じ）
npm run lint-staged

# 単体テスト
npm test
```

## 配布用ビルド

```bash
npm run build
```

成果物は `dist/ac-revisit.user.js` に出力されます。

## License

MIT
