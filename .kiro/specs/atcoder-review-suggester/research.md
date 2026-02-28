## Summary
- **Feature**: `atcoder-review-suggester`
- **Discovery Scope**: New Feature
- **Key Findings**:
  - Tampermonkey は `@match`、`@run-at`、`@grant`、`GM_setValue` / `GM_getValue` を公式に提供しており、ユーザースクリプトの注入対象と専用ストレージを明示できる。
  - TypeScript は `noEmit` によりビルドと独立した型チェックを実施でき、ESLint は現行の Getting Started で flat config ベースの初期化を前提としている。
  - ブラウザ内永続化は `localStorage` でも可能だが、Tampermonkey 専用ストレージのほうが userscript の責務境界に合う。

## Research Log

### Tampermonkey metadata and storage
- **Context**: 配布形態、Tampermonkey 前提、ブラウザ内永続化の設計根拠が必要だった。
- **Sources Consulted**:
  - https://www.tampermonkey.net/documentation.php
- **Findings**:
  - `@match` で対象 URL を指定できる。
  - `@run-at` は `document-start`、`document-body`、`document-end`、`document-idle` を選択できる。
  - `@grant` で `GM_setValue`、`GM_getValue` を明示できる。
  - `GM_setValue` は userscript storage にキー単位で値を保存できる。
- **Implications**:
  - AtCoder 対象の `@match` を明示した userscript header を配布パッケージに含める。
  - 永続化は `GM_*` ストレージを第一選択とし、DOM やページスクリプトと分離された保存境界を持たせる。
  - DOM 構築後に UI を差し込むため、既定の `document-idle` または `document-end` を前提にしたブートストラップが妥当。

### TypeScript and linting workflow
- **Context**: TypeScript 実装、ESLint、ビルドと独立した型チェックの要件をツールチェーン設計に落とす必要があった。
- **Sources Consulted**:
  - https://www.typescriptlang.org/tsconfig/#noEmit
  - https://eslint.org/docs/latest/use/getting-started
- **Findings**:
  - TypeScript の `noEmit` は JavaScript や declaration を出力せず型チェック専用に使える。
  - ESLint 現行ドキュメントは `npm init @eslint/config@latest` と flat config (`eslint.config.js` / `eslint.config.mjs`) を案内している。
- **Implications**:
  - `lint` と `typecheck` を分離した npm scripts を設計前提にする。
  - 実装では TypeScript コンパイルと userscript 向け出力生成を分離し、CI 上でも `tsc --noEmit` 相当を独立実行可能にする。

### Browser persistence boundary
- **Context**: データはブラウザ内永続化であり、外部通信禁止という要件に対して保存方式を選定する必要があった。
- **Sources Consulted**:
  - https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
  - https://www.tampermonkey.net/documentation.php
- **Findings**:
  - `localStorage` は origin 単位でブラウザセッションをまたいで保存される。
  - `GM_setValue` / `GM_getValue` は userscript 固有の保存領域を提供する。
- **Implications**:
  - 設計上は `GM_*` ストレージを標準とし、保存形式は単一 JSON ドキュメントではなく、機能別キー分割で破損範囲を限定する。
  - ストレージアクセスは `ReviewStoreAdapter` に隔離し、将来の保存方式変更余地を残す。

### Greasy Fork publishing constraints
- **Context**: Greasy Fork 配布前提のため、配布物とメタデータの制約を確認したかった。
- **Sources Consulted**:
  - https://greasyfork.org/en/help/code-rules
  - https://greasyfork.org/en/help/meta-keys
- **Findings**:
  - Greasy Fork はスクリプトの説明とメタキーを重視し、主機能は投稿されたコード自体に含まれる必要がある。
  - `@name`、`@description` などの metadata block は UI 表示に使われる。
- **Implications**:
  - 配布物は単体の `.user.js` を主配布対象にし、主機能を外部読み込みに依存しない。
  - メタデータ生成はビルド出力の責務に含め、公開に必要な項目を欠落させない。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Single script monolith | 1 ファイルに UI と状態と DOM 操作を集約 | 初期実装が最短 | 境界が曖昧で保守性が低い | MVP でも変更時に破綻しやすい |
| Layered feature slices | DOM 入出力、アプリケーションサービス、永続化を分離 | 追跡しやすくテストしやすい | 小規模でも抽象化が少し増える | 本機能の規模に対して最適 |
| Full hexagonal | 厳密な ports and adapters | 境界が非常に明確 | userscript MVP に対して過剰 | 将来拡張時の参考に留める |

## Design Decisions

### Decision: レイヤードな userscript 構成を採用する
- **Context**: DOM 注入、日次判定、永続化、UI 操作を同時に扱うため、責務分離が必要だった。
- **Alternatives Considered**:
  1. 単一スクリプト集約
  2. レイヤードな feature slices
- **Selected Approach**: `UserscriptBootstrap`、`AtCoderPageAdapter`、`ReviewMutationService`、`ReviewStoreAdapter`、`PopupPresenter` に分割する。
- **Rationale**: DOM 変更点と状態遷移を分離でき、並行実装でも衝突しにくい。
- **Trade-offs**: ファイル数とインターフェース定義は増えるが、トランザクション境界とテスト対象が明確になる。
- **Follow-up**: タスク生成時に UI 層とドメイン層を分離して実装順を定義する。

### Decision: 永続化は GM storage を標準にする
- **Context**: ブラウザ内永続化かつ外部通信禁止の条件を満たしつつ、userscript とページの境界を保つ必要があった。
- **Alternatives Considered**:
  1. `localStorage`
  2. Tampermonkey `GM_*` storage
- **Selected Approach**: `GM_getValue` / `GM_setValue` を `ReviewStoreAdapter` の実装基盤にする。
- **Rationale**: userscript 固有ストレージであり、AtCoder 側の JavaScript や他スクリプトとの衝突を避けやすい。
- **Trade-offs**: Tampermonkey 依存は増えるが、要件上すでに Tampermonkey 前提のため許容範囲。
- **Follow-up**: 実装時に grant 設定と型定義の整合性を確認する。

### Decision: 今日の一問状態は単一レコードで持つ
- **Context**: 問題ごとの完了フラグを禁止し、単一トランザクションを保証する必要がある。
- **Alternatives Considered**:
  1. 問題ごとに完了属性を持たせる
  2. 今日の提案状態を独立レコード化する
- **Selected Approach**: `dailyState` を単一レコードとして保持し、`reviewItems` と分離する。
- **Rationale**: 問題データは登録日だけ、という制約を守りやすい。
- **Trade-offs**: 操作時に 2 キー更新が必要になるため、書き込み順とロールバック方針が重要になる。
- **Follow-up**: 設計で compare and swap ではなく read modify write の一括コミット手順を定義する。

## Risks & Mitigations
- AtCoder の DOM 変更でメニュー挿入位置が崩れる — `AtCoderPageAdapter` にセレクタ探索と fail closed を集約し、挿入不可時は UI を出さない。
- 日付境界の解釈差で 1 日 1 回制御が不安定になる — ブラウザのローカル日付文字列 `YYYY-MM-DD` を正規化キーとして保存する。
- ストレージ書き込み途中で不整合が出る — `TransactionCoordinator` で更新計画を先に構築し、成功確認後にメモリキャッシュを更新する。

## References
- [Tampermonkey Documentation](https://www.tampermonkey.net/documentation.php) — metadata block、grant、storage API の根拠
- [TypeScript TSConfig noEmit](https://www.typescriptlang.org/tsconfig/#noEmit) — ビルドと独立した型チェックの根拠
- [ESLint Getting Started](https://eslint.org/docs/latest/use/getting-started) — lint 初期化と flat config の現行方針
- [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) — ブラウザ内永続化の代替案比較
- [Greasy Fork code rules](https://greasyfork.org/en/help/code-rules) — 配布物制約
- [Greasy Fork meta keys](https://greasyfork.org/en/help/meta-keys) — metadata block の公開要件
