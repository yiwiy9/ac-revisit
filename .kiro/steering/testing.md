# Testing Standards

このプロジェクトのテストは、userscript の挙動を「純粋ロジック」と「DOM 統合」の 2 軸で固定し、回帰を小さな単位で検知することを目的とする。

## Philosophy

- 実装詳細より、保存結果・状態遷移・画面上の振る舞いを検証する。
- 速く安定したテストを優先し、外部依存は持ち込まない。
- カバレッジの数字より、日付計算・単一スナップショット保存・日次提案・UI 導線のような壊れやすい中核経路を深く守る。
- 配布契約も実装の一部として扱い、build metadata の崩れを見逃さない。

## Organization

- デフォルトは **分離配置**。アプリ本体は `/src/`、テストは `/test/` に置く。
- テストファイル名は `*.test.ts` を標準とする。
- 共通 fixture / double は `/test/support/` に寄せ、各テストから再利用する。
- 新しいテストは、対象レイヤーと同じ責務分割で配置する。例:
  - `src/domain/*` に対する純粋ロジック検証
  - `src/presentation/*` と `src/bootstrap/*` に対する jsdom を使った DOM 検証

## Test Types

- **Unit**: 日付演算、候補抽出、状態遷移、保存正規化などの純粋ロジックを検証する。store double や固定乱数で条件を制御する。
- **Integration**: jsdom 上で menu/toggle 差し込み、ポップアップ描画、起動順序を確認する。DOM を直接組み立てて検証する。
- **Contract**: build script、`package.json` のコマンド、userscript metadata を検証し、配布条件の drift を防ぐ。

## Structure

Vitest の `test()` を基本とし、ケース名は「何が起きるべきか」を明示する。

```typescript
test("ReviewMutationService completes today's problem in one write", () => {
  // Arrange
  const storeDouble = createWorkspaceStoreDouble(createWorkspace());

  // Act
  const result = service.completeTodayProblem(input);

  // Assert
  expect(result.ok).toBe(true);
});
```

- Arrange / Act / Assert の流れを維持し、長いセットアップは helper へ切り出す。
- 1 ケース 1 振る舞いを基本とし、期待値は最終状態を丸ごと比較してよい。

## Mocking & Data

- 外部 API は存在しないため、主な置き換え対象は storage、workspace store、日付、乱数、DOM fixture に限定する。
- システム本体そのものは mock せず、公開関数・サービスを実際に組み合わせて検証する。
- fixture は最小限で意味が読める値を使う。`abc100/abc100_a` のような実在風 ID を標準例にする。
- 共有状態は各テストで初期化し、前ケースの DOM や保存結果を引きずらない。

## Coverage

- 厳密な数値閾値は未固定だが、以下の変更では対応テストを必須とする:
  - `src/shared/` と `src/domain/` のロジック変更
  - `src/persistence/` の schema / 保存ルール変更
  - `src/runtime/` `src/presentation/` `src/bootstrap/` の DOM 挙動変更
  - `scripts/build-userscript.ts` や `package.json` の配布・品質ゲート変更
- バグ修正時は、再発防止のため失敗を再現するテストを先に追加するのを基本とする。

## Execution

- ローカル確認の標準入口は `npm test`。
- 公開前または大きな変更前は `npm run verify` と `npm test` をセットで実行する。
- 配布契約に触れた変更では `npm run build:userscript` まで確認する。
- commit 前の最小ゲートは `husky` の `pre-commit` で自動実行される `npm run lint-staged` とする。
- push 前の標準ゲートは `husky` の `pre-push` から呼ばれる `npm run prepush:guard` とし、これは `npm run verify` と等価である。
- フォーマット差分だけを理由に review ノイズを増やさないため、ローカル整形は `npm run format` または `lint-staged` による自動整形を優先する。

---
_テストファイルの一覧ではなく、何をどの粒度で守るかを固定する_
