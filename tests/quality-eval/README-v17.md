# 品質評価プロンプト v17 (QE-321 〜 QE-340)

Round 17: 微細エッジケース・修正箇所の完全性確認

| ID | 評価軸 | プロンプト | 期待される動作 |
|----|--------|-----------|---------------|
| QE-321 | L(入力バリデーション) | PUT /api/settings/tokenにJSON以外のボディ送信 | 適切なパースエラー |
| QE-322 | K(並行安全性) | 同一ファイルのupload+reconcileが同時実行 | DB UPSERT で安全に処理 |
| QE-323 | M(API整合性) | /api/projects/:id/mcp POST でname空文字 | zodバリデーションで拒否 |
| QE-324 | A(応答品質) | レスポンスがChunked Transferで返される場合のフロント表示 | ストリーミング表示が正常動作 |
| QE-325 | E(デバッグ) | attachStreamReader内でparseLineが例外スロー | 他の行の処理が継続 |
| QE-326 | G(RAGコンテキスト) | buildContextの戻り値が空文字列の場合 | rag-context.mdが削除される |
| QE-327 | C(ファイル生成) | ファイル名が255バイト超のファイルアップロード | FS制限内に切り詰められる |
| QE-328 | D(MCP活用) | MCP config createでtype=preset指定 | スキーマで許可されているか確認 |
| QE-329 | H(セッション継続性) | プロジェクトIDに基づくセッション名のユニーク性 | Date.now()ベースで衝突回避 |
| QE-330 | I(ファイル更新) | hashFile関数での巨大ファイル(1GB)処理 | ストリーミングハッシュまたはスキップ |
| QE-331 | N(エージェント管理) | AgentsRepoServiceのsyncAllでのエラー伝播 | 個別リポジトリ失敗が他に影響しない |
| QE-332 | K(並行安全性) | DBトランザクション内でSELECT→INSERTの原子性 | BEGIN/COMMITで保護 |
| QE-333 | L(入力バリデーション) | upload APIのfileListがFile以外のオブジェクトを含む | instanceof チェックでスキップ |
| QE-334 | M(API整合性) | MCP createのconfigにz.record(z.unknown())の深いネスト | 安全に保存される |
| QE-335 | A(応答品質) | redactor.pushが部分トークンをバッファリング中の中断 | flush()で残りが出力される |
| QE-336 | E(デバッグ) | reconcileProjectFilesのトランザクション内例外 | ROLLBACKで安全に復帰 |
| QE-337 | C(ファイル生成) | download-allのarchive.finalizeエラー時のレスポンス | writerが正しくclose |
| QE-338 | G(RAGコンテキスト) | clearIndex後の即座の検索 | 空の結果が返される |
| QE-339 | B(スキル連携) | skill_pathにnull/undefinedが渡された場合 | DB NOT NULL制約で防止 |
| QE-340 | D(MCP活用) | MCP presetのデフォルト値が正しく適用される | preset_idに基づくconfig生成 |
