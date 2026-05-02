export type Locale = 'ja' | 'en';

const translations = {
  ja: {
    // Sidebar
    'sidebar.title': 'AIRA',
    'sidebar.subtitle': 'AI Runway Application',
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

    // Right panel
    'panel.status': 'ステータス',
    'panel.idle': '進行状況',
    'panel.runHistory': '実行履歴',
    'panel.stop': '停止',
    'panel.noProject': 'プロジェクト未選択',
  },
  en: {
    // Sidebar
    'sidebar.title': 'AIRA',
    'sidebar.subtitle': 'AI Runway Application',
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

    // Right panel
    'panel.status': 'Status',
    'panel.idle': 'Idle',
    'panel.runHistory': 'Run History',
    'panel.stop': 'Stop',
    'panel.noProject': 'No project selected',
  },
} as const;

export type TranslationKey = keyof typeof translations.ja;

export function t(key: TranslationKey, locale: Locale): string {
  return translations[locale][key] ?? key;
}
