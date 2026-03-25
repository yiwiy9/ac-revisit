# Deployment Standards

このプロジェクトの「デプロイ」は、サーバー公開ではなく、Greasy Fork へ投稿する userscript 配布物を安全に生成・更新することを指す。運用の中心は、再現可能な build、公開前の品質ゲート、単純なロールバックである。

## Philosophy

- 公開前に必ず検証し、未検証の成果物を配布しない。
- 配布物は再現可能な単一ファイルを維持し、生成経路を分散させない。
- 問題発生時は fix-forward より、前バージョンへ戻せる単純さを優先する。
- 公開手順は「手数が少ない」より「判断基準が明確」を優先する。

## Release Artifact

- 配布対象は `dist/ac-revisit.user.js` のみを基本とする。
- 成果物は userscript metadata block を先頭に持つ単一ファイルであること。
- metadata の `@version` は `package.json.version` を唯一の供給元とする。
- 外部スクリプト参照に依存する成果物は配布対象にしない。

## Release Flow

標準フローは次の順序を守る。

```bash
npm run verify
npm run build
```

- `npm run verify` は公開前の必須品質ゲートとする。
- `npm run build` は、`verify` 成功後の成果物生成コマンドとして扱う。
- `npm run build:userscript` は補助用途であり、公開判断の根拠は `npm run build` または `verify` 済みであることに置く。
- 公開作業は、生成された `dist/ac-revisit.user.js` を確認してから行う。
- `AC_REVISIT_REVIEW_INTERVAL_DAYS` を付けた build は公開物の動作仕様を変えるため、意図した仕様変更として扱い、未指定の 14 日 build と混同しない。

## Quality Gates

- `verify` が失敗した場合は公開しない。
- 少なくとも以下が通っていることを公開条件とする:
  - lint
  - typecheck
  - script/test 向け TypeScript 検証
  - Vitest による回帰確認
- build metadata や配布契約に関わる変更では、成果物先頭の metadata block も確認する。

## Versioning

- 配布バージョンの更新は `package.json.version` を起点に行う。
- バージョンを変えずに配布物だけ差し替える運用は避ける。
- metadata と `package.json` の整合が取れない状態では build を失敗させる方針を維持する。
- リリースノートが必要になっても、まず version と成果物整合を優先する。

## Publishing Constraints

- 配布先前提は Greasy Fork とし、Greasy Fork が期待する metadata を崩さない。
- `@match` は AtCoder 全体を対象にする既存契約を維持する。
- `@grant` は最小権限を維持し、権限追加は公開フロー変更として扱う。
- 配布前提を変える変更は、build script、contract test、steering を同時に更新する。

## Rollback

- 配布不具合時は、直前に安定していた userscript バージョンへ戻す方針を基本とする。
- ロールバックの最小単位は「前の公開済み `.user.js`」であり、部分 hotfix を前提にしない。
- 修正版を再公開する場合も、同じ品質ゲートを再実行する。

## Change Triggers

- 次の変更は `deployment.md` の更新対象とする:
  - build コマンドや公開前フローの変更
  - metadata 項目や生成方法の変更
  - 配布先や成果物形式の変更
  - バージョニング方針の変更
- 既存フローに従う内部実装変更だけなら、この steering は更新不要。

---
_サーバー運用手順ではなく、userscript 配布の再現可能な公開手順を固定する_
