# Error Handling Standards

このプロジェクトのエラー処理は、userscript を静かに動かし続けるために、既知の失敗を小さな列挙型で表現し、境界で fail-closed に収束させることを基本とする。

## Philosophy

- 例外を多層に投げ回すより、既知の失敗は `Result` 型で返して呼び出し側に判断させる。
- AtCoder DOM や storage のような不安定な境界では、機能を静かに止めるか再描画し、利用者向けノイズを増やさない。
- 未知の破綻は早く止めてよいが、通常系で想定済みの失敗は「安全に何もしない」方向を優先する。
- エラー処理の目的は詳細表示ではなく、状態破壊の防止と次の操作可能性の維持である。

## Classification

- **Boundary resolution errors**: DOM アンカー未解決、問題文脈未解決など。機能を差し込まず終了する。
- **Storage errors**: 読み書き不能。再試行せず、その操作だけを中止する。
- **State mismatch errors**: stale popup 状態や日跨ぎなど。更新を拒否し、必要なら最新状態へ再同期する。
- **Business rule errors**: 候補なし、未完了時の「もう一問」禁止、当日問題不在など。状態を壊さず操作を拒否する。
- **Invariant violations**: 通常は起きない前提の内部矛盾。局所的に throw してよいが、常用しない。

## Error Shape

既知エラーは、安定した `kind` を持つオブジェクトで表す。

```typescript
type MutationError =
  | { readonly kind: "stale_session" }
  | { readonly kind: "storage_unavailable" };
```

- 文字列メッセージを制御フローの唯一の根拠にしない。
- `kind` は短く安定した列挙名にし、UI 文言と直接結び付けない。
- 失敗時も部分更新を残さず、返却値だけで成功/失敗を判断できる形を保つ。

## Propagation

- **Shared / Domain / Persistence**: 既知の失敗は `Result<Success, Error>` で返す。
- **Runtime**: DOM 解決失敗は `anchor_missing` や `problem_unresolvable` として返し、呼び出し側が差し込みを諦める。
- **Bootstrap**: 失敗を集約し、必要に応じて診断イベントを記録する。通常利用では追加 UI 通知に変換しない。
- **Presentation**: stale 状態や保存失敗では操作を継続せず、最新状態の再読込または無動作へ戻す。

## User-Facing Behavior

- DOM 差し込みに失敗しても、アラートやトーストは出さず静かに停止する。
- ポップアップ操作中に stale が見つかった場合、追加エラーメッセージは出さず再描画で収束させる。
- 保存失敗時も既存状態を壊さず、ボタン表示やトグル表示を保守的に維持する。
- 「動かないことがある」より「誤って状態を壊すこと」を重い失敗とみなす。

## Diagnostics

- 開発時診断は `code`, `component`, `operation` の最小セットで記録する。
- 診断は注入可能な sink に流し、通常利用で恒常ログ出力しない。
- 診断コードは、利用者向けメッセージではなく、fail-closed 理由の追跡に使う。
- 新しい診断を追加する場合も、機密情報や全文 DOM を含めない。

## Retry Policy

- storage 読み書きは retry しない。
- DOM 探索は継続監視や self-healing を追加せず、その時点の解決結果だけで判断する。
- stale 状態は「同じ更新の再試行」ではなく、「最新状態の再評価」で解決する。

## Recovery Rules

- 保存値の schema 不整合や論理不整合は、部分復旧せず canonical な空状態へフォールバックする。
- 提案状態の不整合は、その場の再同期か当日提案の再確定で収束させる。
- 解除・完了のような複数ステップ更新は、単一 write を前提にし、失敗時は途中結果を残さない。

---
_例外の詳細説明ではなく、失敗をどう安全に扱うかの判断基準を固定する_
