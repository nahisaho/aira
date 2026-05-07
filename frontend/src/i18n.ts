export type Locale = 'ja' | 'en';

const translations = {
  ja: {
    // Sidebar
    'sidebar.title': 'AIRA-β',
    'sidebar.subtitle': 'AI Research Administrator',
    'sidebar.newProject': '+ 新規',
    'sidebar.settings': '⚙ 設定',
    'sidebar.deleteProject': 'プロジェクトを削除',
    'sidebar.loading': '読み込み中...',

    // Chat
    'chat.selectProject': 'プロジェクトを選択または作成してください',
    'chat.loadingMessages': 'メッセージを読み込み中...',
    'chat.placeholder': 'メッセージを入力...',
    'chat.send': '送信',
    'chat.sending': '...',
    'chat.attach': '添付ファイル',
    'chat.attachedFiles': '添付ファイル',
    'chat.placeholderWithFiles': 'メッセージを入力（または添付のみで送信）...',
    'chat.reconnecting': '⟳ 再接続中...',
    'chat.disconnected': '⊘ 切断',

    // Settings
    'settings.title': '設定',
    'settings.token': 'GitHub トークン',
    'settings.tokenConfigured': '✓ トークン設定済み',
    'settings.tokenNotConfigured': '⚠ トークン未設定',
    'settings.validate': '検証',
    'settings.validating': '検証中...',
    'settings.remove': '削除',
    'settings.save': '保存',
    'settings.tokenValid': '✓ 有効',
    'settings.tokenInvalid': '✗ 無効なトークン',
    'settings.language': '言語',
    'settings.viewMode': '表示モード',
    'settings.light': 'ライト',
    'settings.dark': 'ダーク',
    'settings.cli': 'Copilot CLI',
    'settings.cliVersion': 'バージョン',
    'settings.cliNotFound': 'CLI が見つかりません',
    'settings.cliUpdate': 'アップデート',
    'settings.cliUpdating': 'アップデート中...',
    'settings.cliUpdateSuccess': '✓ アップデート完了',
    'settings.cliUpdateFailed': '✗ アップデート失敗',

    // Agents Repos
    'settings.agentsRepo': 'Agents リポジトリ',
    'settings.agentsRepoAdd': '追加',
    'settings.agentsRepoNone': 'リポジトリ未登録',
    'settings.agentsRepoSync': '同期',
    'settings.agentsRepoLastSync': '最終同期',
    'settings.agentsRepoError.REPO_NOT_FOUND': 'GitHub リポジトリが存在しません。URL を確認してください。',
    'settings.agentsRepoError.AUTH_FAILED': 'GitHub リポジトリへのアクセスが拒否されました。トークンと URL を確認してください。',
    'settings.agentsRepoError.NO_AGENTS_DIR': 'リポジトリに agents/ ディレクトリが見つかりません。',
    'settings.agentsRepoError.SYNC_FAILED': '同期に失敗しました。',

    // Send key
    'settings.sendKey': 'メッセージ送信',
    'settings.sendKey.Enter': 'Enter キー',
    'settings.sendKey.CtrlEnter': 'Ctrl + Enter キー',
    'settings.sendKey.hint.Enter': 'Shift+Enter で改行',
    'settings.sendKey.hint.CtrlEnter': 'Enter で改行',

    // Projects
    'project.newTitle': '新規プロジェクト',
    'project.nameLabel': 'プロジェクト名',
    'project.namePlaceholder': 'プロジェクト名を入力',
    'project.create': '作成',
    'project.cancel': 'キャンセル',
    'project.deleteTitle': 'プロジェクトを削除',
    'project.deleteConfirm': 'を削除しますか？この操作は取り消せません。',
    'project.delete': '削除',

    // Files
    'files.title': '出力ファイル',
    'files.noFiles': 'ファイルなし',
    'files.download': 'ダウンロード',
    'files.view': '表示',
    'files.delete': '削除',
    'files.deleteConfirm': 'このファイルを削除しますか？',
    'files.close': '閉じる',
    'files.downloadAll': '一括DL',
    'files.inputTitle': '入力ファイル',
    'files.noInputFiles': '入力ファイルなし',
    'files.add': '追加',

    // Right panel
    'panel.status': 'ステータス',
    'panel.idle': '進行状況',
    'panel.runHistory': '実行履歴',
    'panel.stop': '停止',
    'panel.noProject': 'プロジェクト未選択',

    // Skills
    'skills.title': 'Agent Skills',
    'skills.assigned': '割り当て済み',
    'skills.available': '利用可能なスキル',
    'skills.noSkills': 'スキルなし',
    'skills.assign': '追加',
    'skills.unassign': '解除',
    'skills.builtin': 'ビルトイン',

    // MCP
    'mcp.title': 'MCP サーバー',
    'mcp.add': '追加',
    'mcp.addTitle': 'MCP サーバーを追加',
    'mcp.name': 'サーバー名',
    'mcp.type': 'タイプ',
    'mcp.command': 'コマンド',
    'mcp.args': '引数 (カンマ区切り)',
    'mcp.url': 'URL',
    'mcp.noConfigs': 'MCP サーバーなし',
    'mcp.enabled': '有効',
    'mcp.disabled': '無効',
    'mcp.delete': '削除',
  },
  en: {
    // Sidebar
    'sidebar.title': 'AIRA-β',
    'sidebar.subtitle': 'AI Research Administrator',
    'sidebar.newProject': '+ New',
    'sidebar.settings': '⚙ Settings',
    'sidebar.deleteProject': 'Delete project',
    'sidebar.loading': 'Loading...',

    // Chat
    'chat.selectProject': 'Select or create a project to begin',
    'chat.loadingMessages': 'Loading messages...',
    'chat.placeholder': 'Type a message...',
    'chat.send': 'Send',
    'chat.sending': '...',
    'chat.attach': 'Attach files',
    'chat.attachedFiles': 'Attached files',
    'chat.placeholderWithFiles': 'Type a message (or send attachments only)...',
    'chat.reconnecting': '⟳ Reconnecting...',
    'chat.disconnected': '⊘ Disconnected',

    // Settings
    'settings.title': 'Settings',
    'settings.token': 'GitHub Token',
    'settings.tokenConfigured': '✓ Token configured',
    'settings.tokenNotConfigured': '⚠ Token not configured',
    'settings.validate': 'Validate',
    'settings.validating': 'Validating...',
    'settings.remove': 'Remove',
    'settings.save': 'Save',
    'settings.tokenValid': '✓ Valid',
    'settings.tokenInvalid': '✗ Invalid token',
    'settings.language': 'Language',
    'settings.viewMode': 'View Mode',
    'settings.light': 'Light',
    'settings.dark': 'Dark',
    'settings.cli': 'Copilot CLI',
    'settings.cliVersion': 'Version',
    'settings.cliNotFound': 'CLI not found',
    'settings.cliUpdate': 'Update',
    'settings.cliUpdating': 'Updating...',
    'settings.cliUpdateSuccess': '✓ Update complete',
    'settings.cliUpdateFailed': '✗ Update failed',

    // Agents Repos
    'settings.agentsRepo': 'Agents Repositories',
    'settings.agentsRepoAdd': 'Add',
    'settings.agentsRepoNone': 'No repositories configured',
    'settings.agentsRepoSync': 'Sync',
    'settings.agentsRepoLastSync': 'Last synced',
    'settings.agentsRepoError.REPO_NOT_FOUND': 'GitHub repository not found. Please check the URL.',
    'settings.agentsRepoError.AUTH_FAILED': 'Access denied. Please check your token and URL.',
    'settings.agentsRepoError.NO_AGENTS_DIR': 'No agents/ directory found in the repository.',
    'settings.agentsRepoError.SYNC_FAILED': 'Sync failed.',

    // Send key
    'settings.sendKey': 'Send message',
    'settings.sendKey.Enter': 'Enter key',
    'settings.sendKey.CtrlEnter': 'Ctrl + Enter key',
    'settings.sendKey.hint.Enter': 'Shift+Enter for new line',
    'settings.sendKey.hint.CtrlEnter': 'Enter for new line',

    // Projects
    'project.newTitle': 'New Project',
    'project.nameLabel': 'Project Name',
    'project.namePlaceholder': 'Enter project name',
    'project.create': 'Create',
    'project.cancel': 'Cancel',
    'project.deleteTitle': 'Delete Project',
    'project.deleteConfirm': '? This action cannot be undone.',
    'project.delete': 'Delete',

    // Files
    'files.title': 'Files',
    'files.noFiles': 'No files yet',
    'files.download': 'Download',
    'files.view': 'View',
    'files.delete': 'Delete',
    'files.deleteConfirm': 'Delete this file?',
    'files.close': 'Close',
    'files.downloadAll': 'Download All',
    'files.inputTitle': 'Input Files',
    'files.noInputFiles': 'No input files',
    'files.add': 'Add',

    // Right panel
    'panel.status': 'Status',
    'panel.idle': 'Idle',
    'panel.runHistory': 'Run History',
    'panel.stop': 'Stop',
    'panel.noProject': 'No project selected',

    // Skills
    'skills.title': 'Agent Skills',
    'skills.assigned': 'Assigned',
    'skills.available': 'Available Skills',
    'skills.noSkills': 'No skills',
    'skills.assign': 'Add',
    'skills.unassign': 'Remove',
    'skills.builtin': 'Built-in',

    // MCP
    'mcp.title': 'MCP Servers',
    'mcp.add': 'Add',
    'mcp.addTitle': 'Add MCP Server',
    'mcp.name': 'Server Name',
    'mcp.type': 'Type',
    'mcp.command': 'Command',
    'mcp.args': 'Arguments (comma separated)',
    'mcp.url': 'URL',
    'mcp.noConfigs': 'No MCP servers',
    'mcp.enabled': 'Enabled',
    'mcp.disabled': 'Disabled',
    'mcp.delete': 'Delete',
  },
} as const;

export type TranslationKey = keyof typeof translations.ja;

export function t(key: TranslationKey, locale: Locale): string {
  return translations[locale][key] ?? key;
}
