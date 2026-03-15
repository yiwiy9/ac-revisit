# Technology Stack

## Architecture

このプロジェクトは、単一 userscript を出力する TypeScript 実装であり、`bootstrap` を起点に `runtime`、`domain`、`persistence`、`presentation`、`shared` を薄く分離するレイヤード構成を採る。UI はフレームワークを使わず、ブラウザ DOM を直接操作する。

## Core Technologies

- **Language**: TypeScript
- **Runtime**: Browser (Tampermonkey), build/test time は Node.js
- **Packaging**: esbuild で単一 `.user.js` を生成

## Key Libraries

- **@types/tampermonkey**: GM API を型付きで扱う前提を固定する。
- **ESLint + typescript-eslint**: `any` 逃げを禁止し、静的解析を最低限の品質ゲートにする。
- **Prettier**: コードとドキュメント整形を自動化し、フォーマット差分を局所化する。
- **husky + lint-staged**: commit / push 前の品質ゲートをローカルで自動実行する。
- **Vitest + jsdom**: DOM を含む userscript 挙動を Node 上で再現して検証する。
- **tsx**: build script を TypeScript のまま実行する。

## Development Standards

### Type Safety

- `tsconfig.json` は `strict: true` と `noEmit: true` を前提とする。
- アプリ本体は Tampermonkey 型を直接利用し、独自の `declare` で GM API を再定義しない。
- 共通状態は `src/shared/types.ts` を型の単一ソースとする。
- `@typescript-eslint/no-explicit-any` は `error`。型を曖昧化して回避しない。

### Code Quality

- lint と typecheck は build から独立して実行できる状態を維持する。
- フォーマットは Prettier を単一の整形基準とし、`npm run format` / `npm run format:check` を利用できる状態を維持する。
- staged file に対する整形と軽量な自動修正は `lint-staged` に集約し、`*.{js,mjs,cjs,ts,tsx}` へ `prettier --write` と `eslint --max-warnings=0 --fix`、`*.{json,md,yml,yaml}` へ `prettier --write` を適用する。
- 失敗時は再試行や自動復旧より、`Result` 型で失敗を返して fail-closed に寄せる。
- 実行時ログは常時出力せず、必要最小限の診断情報を注入可能にする。

### Local Automation

- `husky` により `pre-commit` で `npm run lint-staged`、`pre-push` で `npm run prepush:guard` を実行する。
- `prepush:guard` は `npm run verify` を呼び出し、lint・typecheck・test を push 前の標準品質ゲートとして扱う。
- `.prettierignore` には配布物、依存ディレクトリ、エージェント管理ディレクトリ、spec/steering 以外の機械管理領域を含め、不要な整形対象を広げない。

### Testing

- 単体テストは日付計算、保存、状態遷移の純粋ロジックを優先して固定する。
- 統合寄りテストは jsdom 上で DOM 差し込みとポップアップ挙動を確認する。
- 配布契約もテスト対象に含め、metadata と build コマンドの崩れを検知する。

## Development Environment

### Required Tools

- Node.js 環境で `npm` を実行できること
- Tampermonkey 対象の型解決ができる TypeScript ツールチェーン

### Common Commands

```bash
# Build: npm run build
# Verify: npm run verify
# Test: npm test
# Userscript only: npm run build:userscript
```

## Key Technical Decisions

- 配布物は外部 JavaScript 読み込みに依存しない単一ファイルを維持する。
- ストレージはブラウザ内の GM storage を唯一の永続化先とし、外部通信は追加しない。
- 日付判定はローカル暦日の `YYYY-MM-DD` キーへ正規化してから比較する。
- UI 更新前の整合確認を入れ、stale 状態では操作を続行せず再描画へ戻す。

---
_依存関係の一覧ではなく、実装判断に影響する技術基準だけを保持する_
