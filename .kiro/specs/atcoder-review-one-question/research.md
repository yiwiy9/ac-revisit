# Research & Design Decisions

## Summary
- **Feature**: `atcoder-review-one-question`
- **Discovery Scope**: New Feature
- **Key Findings**:
  - 実装コードが未存在のため、既存拡張ではなく greenfield 前提で境界を先に固定する必要がある。
  - Tampermonkey と Greasy Fork の公式仕様上、`@match` と `@grant` を最小化した構成が配布・審査双方で安全。
  - 永続化は Tampermonkey GM Storage を主軸にでき、要件の「ブラウザ内完結」「外部通信なし」と整合する。

## Research Log

### ユーザースクリプト配布と実行制約
- **Context**: 要件 9.1, 9.2 を満たす配布・実行形態を設計に固定するため。
- **Sources Consulted**:
  - https://www.tampermonkey.net/documentation.php
  - https://greasyfork.org/en/help/code-rules
- **Findings**:
  - メタデータブロックで `@match`、`@grant`、`@namespace` などを明示する運用が前提。
  - Greasy Fork は難読化や不要な外部実行を禁止し、監査可能なコード構成が求められる。
- **Implications**:
  - 設計時点で AtCoder ドメイン限定マッチと最小権限方針を固定する。
  - 外部通信コンポーネントを持たない構造を明示し、審査リスクを下げる。

### ブラウザ内永続化の選定
- **Context**: 要件 1.2, 1.3, 3.x, 5.x, 6.x の状態管理基盤を確定するため。
- **Sources Consulted**:
  - https://www.tampermonkey.net/documentation.php
- **Findings**:
  - `GM_getValue` / `GM_setValue` / `GM_deleteValue` でユーザースクリプト領域へ永続化できる。
  - AtCoderオリジンのストレージ消去影響を受けにくく、スクリプト責務として状態を独立管理できる。
- **Implications**:
  - データモデルを「復習対象」「日次制御」「現在提案」に分離し、単位更新で破損影響を局所化する。
  - 保存失敗時でも手動完了フローを阻害しないエラーハンドリングが必要。

### 1日1回提案と日付境界
- **Context**: 要件 4.1-4.6 と 6.6 の整合性確保。
- **Sources Consulted**:
  - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
- **Findings**:
  - ローカル日付判定は `YYYY-MM-DD` 正規化で再現可能。
  - 通知回数制御と提案選定制御を同一キーで管理すると仕様変更に弱い。
- **Implications**:
  - `lastSuggestionDate` と `lastPopupDate` を分離保存する。
  - 「もう1問」で提案更新してもポップアップ増加しない構造を採用する。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 単一巨大スクリプト | すべての機能を1モジュールに集約 | 初期実装が速い | 仕様追加で責務混在、検証困難 | 不採用 |
| 機能別モジュール分割 | UI/判定/永続化を分離し単一エントリで統合 | テスト容易、境界明確、将来拡張しやすい | 初期設計工数が増える | 採用 |
| 状態機械中心 | 提案状態遷移を厳密機械化 | 状態不整合を抑制 | MVPには過剰、実装負荷増 | 一部概念のみ採用 |

## Design Decisions

### Decision: AtCoder DOM 依存を Adapter 境界に閉じ込める
- **Context**: ページ種別ごとの UI 注入点が異なる。
- **Alternatives Considered**:
  1. ページごとに独立ロジックを重複実装
  2. ページ判定とDOM取得を Adapter 化
- **Selected Approach**: `PageContextAdapter` がページ種別と主要アンカー要素を提供し、上位サービスは DOM 詳細を知らない構造。
- **Rationale**: DOM変更影響を局所化できる。
- **Trade-offs**: Adapter メンテナンスが必要。
- **Follow-up**: 実装時に AtCoder の主要テンプレート差分を確認。

### Decision: Current Suggestion を独立レコードで管理
- **Context**: 要件 5.x, 6.x で現在提案の保持/完了/削除/差し替えが複雑。
- **Alternatives Considered**:
  1. 復習対象配列に現在提案フラグを埋め込む
  2. 現在提案を独立ストアで保持
- **Selected Approach**: `currentSuggestion` を独立保存し、復習対象とは参照関係で結ぶ。
- **Rationale**: クリア時や削除時の副作用制御が容易。
- **Trade-offs**: 整合性チェックが必要。
- **Follow-up**: 起動時に参照先消失の自己修復処理を定義。

### Decision: 日次制御キーを分離する
- **Context**: 1日1回通知と提案選定が別条件。
- **Alternatives Considered**:
  1. 単一日付キーで兼用
  2. 通知日付と提案日付を分離
- **Selected Approach**: `lastPopupDate` と `lastSelectionDate` を分離。
- **Rationale**: 「もう1問」時の通知抑止と提案更新を両立できる。
- **Trade-offs**: 保存項目が増える。
- **Follow-up**: タイムゾーン境界テストケースを重点化。

## Risks & Mitigations
- AtCoder DOM 変更で導線注入に失敗するリスク — セレクタを集約定義し、見つからない場合は安全に機能停止。
- GMストレージの読み書き失敗/破損リスク — 名前空間キー分割とバージョン付きスキーマで移行可能性を確保。
- 自動AC誤判定リスク — 提出詳細ページかつ問題ID一致かつ当日ACのみで完了記録。

## References
- [Tampermonkey Documentation](https://www.tampermonkey.net/documentation.php) — メタデータと API 仕様
- [Greasy Fork Code Rules](https://greasyfork.org/en/help/code-rules) — 配布時のコード制約
- [MDN Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) — ローカル日付判定基盤
