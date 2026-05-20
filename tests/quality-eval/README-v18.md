# 品質評価プロンプト v18 (QE-341 〜 QE-360)

Round 18: 修正箇所の回帰 + 未探索パスの最終確認

| ID | 評価軸 | プロンプト | 期待される動作 |
|----|--------|-----------|---------------|
| QE-341 | K(並行安全性) | parseLine内のonFileCreatedコールバックで例外発生 | try-catchで捕捉され次の行処理が継続 |
| QE-342 | L(入力バリデーション) | ファイルview APIで50MB上限を超えるhashFile呼び出し | 空ハッシュが返され処理継続 |
| QE-343 | M(API整合性) | archiver zip生成で空ワークスペースの場合 | 空のZIPが正常にダウンロード |
| QE-344 | A(応答品質) | 200バイト超のファイル名アップロード後のDB整合性 | 切り詰め後の名前でDB登録 |
| QE-345 | E(デバッグ) | auth.service.tsのvalidateToken失敗時のエラー情報 | 適切なHTTPステータスとメッセージ |
| QE-346 | G(RAGコンテキスト) | buildContextのmaxChars=0でのコンテキスト生成 | 空コンテキストが返される |
| QE-347 | C(ファイル生成) | ファイルviewのstat+readの間にファイルが削除された | ENOENTエラーがハンドリング |
| QE-348 | D(MCP活用) | scavengeStaleConfigs削除対象ファイルが使用中 | EBUSYエラーがスキップされる |
| QE-349 | H(セッション継続性) | projectSessionsマップのメモリリーク確認 | プロジェクト削除時にクリアされる |
| QE-350 | I(ファイル更新) | scanWorkspace depth=50でMAX_DEPTHに達した場合 | 静かにスキップ（ログ出力あり） |
| QE-351 | N(エージェント管理) | agent-managerのrunner.currentCallbacksがnullの場合 | nullチェックでクラッシュ回避 |
| QE-352 | K(並行安全性) | writer.abort()後のarchive.on('data')呼び出し | エラーなく処理 |
| QE-353 | L(入力バリデーション) | req.parseBody()のパースエラー | 適切なエラーレスポンス |
| QE-354 | M(API整合性) | GETリクエストにボディを含めた場合 | ボディが無視される |
| QE-355 | A(応答品質) | enableStaticServingでのSPA fallbackの正確性 | /api/*以外は全てindex.htmlに |
| QE-356 | E(デバッグ) | DB初期化失敗時のエラーメッセージ | WASMバイナリ不在の明確なエラー |
| QE-357 | G(RAGコンテキスト) | reindexProjectのclearIndex+reindex原子性 | 途中失敗でも整合性維持 |
| QE-358 | C(ファイル生成) | view API stat→readの間にファイルサイズ変更 | 読み取り後のサイズで処理 |
| QE-359 | B(スキル連携) | seedBuiltinSkillsの2回実行時の冪等性 | 重複スキルが作成されない |
| QE-360 | D(MCP活用) | proxy requestのpath値のバリデーション | パストラバーサル防止 |
