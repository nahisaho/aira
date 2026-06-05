import { Fragment, useEffect, useState } from 'react';
import { skillsApi, mcpApi, ragApi, type Skill, type McpConfig, type RagSettings, type RagStats } from '../../api/client';
import { usePreferencesStore } from '../../stores/preferences';
import { useT } from '../../useT';

interface Props {
  projectId: string;
  onClose: () => void;
}

export function ProjectSettingsPane({ projectId, onClose }: Props) {
  const t = useT();
  const theme = usePreferencesStore((s) => s.theme);
  const light = theme === 'light';
  const [tab, setTab] = useState<'skills' | 'mcp' | 'rag'>('skills');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto ${light ? 'bg-white' : 'bg-gray-800'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <TabButton active={tab === 'skills'} onClick={() => setTab('skills')} light={light}>
              {t('skills.title')}
            </TabButton>
            <TabButton active={tab === 'mcp'} onClick={() => setTab('mcp')} light={light}>
              {t('mcp.title')}
            </TabButton>
            <TabButton active={tab === 'rag'} onClick={() => setTab('rag')} light={light}>
              RAG
            </TabButton>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
        </div>

        {tab === 'skills' ? (
          <SkillsTab projectId={projectId} />
        ) : tab === 'mcp' ? (
          <McpTab projectId={projectId} />
        ) : (
          <RagTab projectId={projectId} />
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, light, children }: {
  active: boolean; onClick: () => void; light: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : light
            ? 'text-gray-600 hover:bg-gray-100'
            : 'text-gray-400 hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Skills Tab ───

function SkillsTab({ projectId }: { projectId: string }) {
  const t = useT();
  const theme = usePreferencesStore((s) => s.theme);
  const light = theme === 'light';

  const [projectSkills, setProjectSkills] = useState<Skill[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [proj, all] = await Promise.all([
        skillsApi.listProject(projectId),
        skillsApi.listAll(),
      ]);
      setProjectSkills(proj);
      setAllSkills(all);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() fetches project data on mount / projectId change
  useEffect(() => { load(); }, [projectId]);

  const assignedIds = new Set(projectSkills.map((s) => s.id));
  const unassigned = allSkills.filter((s) => !assignedIds.has(s.id));

  const handleAssign = async (skillId: string) => {
    await skillsApi.assign(projectId, skillId);
    await load();
  };

  const handleUnassign = async (skillId: string) => {
    await skillsApi.unassign(projectId, skillId);
    await load();
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Assigned skills */}
      <div>
        <h4 className={`text-xs font-semibold uppercase mb-2 ${light ? 'text-gray-500' : 'text-gray-400'}`}>
          {t('skills.assigned')} ({projectSkills.length})
        </h4>
        {projectSkills.length === 0 && (
          <p className={`text-xs ${light ? 'text-gray-400' : 'text-gray-500'}`}>{t('skills.noSkills')}</p>
        )}
        <div className="space-y-1">
          {projectSkills.map((skill) => (
            <div key={skill.id} className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
              light ? 'bg-gray-50' : 'bg-gray-700'
            }`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={light ? 'text-gray-900' : 'text-gray-200'}>{skill.name}</span>
                  <StatusDot status={skill.status} />
                  {skill.builtin === 1 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400 font-medium">
                      {t('skills.builtin')}
                    </span>
                  )}
                </div>
                {skill.description && (
                  <p className={`text-xs mt-0.5 truncate ${light ? 'text-gray-400' : 'text-gray-500'}`}>
                    {skill.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleUnassign(skill.id)}
                className="text-xs text-red-400 hover:text-red-300 ml-2 shrink-0"
              >
                {t('skills.unassign')}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Available (unassigned) skills */}
      {unassigned.length > 0 && (
        <div>
          <h4 className={`text-xs font-semibold uppercase mb-2 ${light ? 'text-gray-500' : 'text-gray-400'}`}>
            {t('skills.available')}
          </h4>
          <div className="space-y-1">
            {unassigned.map((skill) => (
              <div key={skill.id} className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
                light ? 'bg-gray-50' : 'bg-gray-700'
              }`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={light ? 'text-gray-900' : 'text-gray-200'}>{skill.name}</span>
                    <StatusDot status={skill.status} />
                    {skill.builtin === 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400 font-medium">
                        {t('skills.builtin')}
                      </span>
                    )}
                  </div>
                  {skill.description && (
                    <p className={`text-xs mt-0.5 truncate ${light ? 'text-gray-400' : 'text-gray-500'}`}>
                      {skill.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleAssign(skill.id)}
                  className="text-xs text-blue-400 hover:text-blue-300 ml-2 shrink-0"
                >
                  {t('skills.assign')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'available' ? 'bg-green-500' : status === 'importing' ? 'bg-yellow-500' : 'bg-red-500';
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ml-2 ${color}`} title={status} />;
}

// ─── MCP Tab ───

function McpTab({ projectId }: { projectId: string }) {
  const t = useT();
  const theme = usePreferencesStore((s) => s.theme);
  const light = theme === 'light';

  const [configs, setConfigs] = useState<McpConfig[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'stdio' | 'sse' | 'http'>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setConfigs(await mcpApi.list(projectId));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() fetches project data on mount / projectId change
  useEffect(() => { load(); }, [projectId]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setError('');
    try {
      const config: Record<string, unknown> = type === 'stdio'
        ? { command: command.trim(), args: args.split(',').map((a) => a.trim()).filter(Boolean) }
        : { url: url.trim() };  // sse and http both use URL field

      await mcpApi.create(projectId, name.trim(), type, config);
      setName('');
      setCommand('');
      setArgs('');
      setUrl('');
      setShowAdd(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleToggle = async (configId: string, enabled: boolean) => {
    await mcpApi.toggle(projectId, configId, !enabled);
    await load();
  };

  const handleDelete = async (configId: string) => {
    await mcpApi.delete(projectId, configId);
    await load();
  };

  return (
    <div className="space-y-4">
      {/* MCP configs list */}
      {configs.length === 0 && (
        <p className={`text-xs ${light ? 'text-gray-400' : 'text-gray-500'}`}>{t('mcp.noConfigs')}</p>
      )}
      <div className="space-y-1">
        {configs.map((cfg) => {
          const desc = typeof cfg.config?.description === 'string' ? cfg.config.description : null;
          return (
          <Fragment key={cfg.id}>
          <div className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
            light ? 'bg-gray-50' : 'bg-gray-700'
          }`}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.enabled ? 'bg-green-500' : 'bg-gray-500'}`} />
              <span className={light ? 'text-gray-900' : 'text-gray-200'}>{cfg.name}</span>
              <span className={`text-xs ${light ? 'text-gray-400' : 'text-gray-500'}`}>({cfg.type})</span>
              {cfg.builtin === 1 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400 font-medium shrink-0">
                  {t('skills.builtin')}
                </span>
              )}
              {desc && (
                <span className={`text-xs truncate ${light ? 'text-gray-400' : 'text-gray-500'}`}>
                  {desc}
                </span>
              )}
            </div>
            <div className="flex gap-2 shrink-0 ml-2">
              <button
                onClick={() => setEditingId(editingId === cfg.id ? null : cfg.id)}
                className={`text-xs ${editingId === cfg.id ? 'text-gray-400' : 'text-blue-400 hover:text-blue-300'}`}
              >
                {editingId === cfg.id ? t('mcp.cancel') : t('mcp.edit')}
              </button>
              <button
                onClick={() => handleToggle(cfg.id, cfg.enabled)}
                className={`text-xs ${cfg.enabled ? 'text-yellow-400' : 'text-green-400'}`}
              >
                {cfg.enabled ? t('mcp.disabled') : t('mcp.enabled')}
              </button>
              {cfg.builtin !== 1 && (
                <button
                  onClick={() => handleDelete(cfg.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  {t('mcp.delete')}
                </button>
              )}
            </div>
          </div>
          {editingId === cfg.id && (
            <EditMcpForm
              config={cfg}
              projectId={projectId}
              onSaved={async () => { setEditingId(null); await load(); }}
              onCancel={() => setEditingId(null)}
            />
          )}
          </Fragment>
          );
        })}
      </div>

      {/* Add form */}
      {showAdd ? (
        <div className={`rounded p-3 space-y-2 ${light ? 'bg-gray-50' : 'bg-gray-700'}`}>
          <h4 className={`text-sm font-semibold ${light ? 'text-gray-800' : 'text-gray-200'}`}>
            {t('mcp.addTitle')}
          </h4>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('mcp.name')}
            className={`w-full rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              light ? 'bg-white border border-gray-300 text-gray-900' : 'bg-gray-600 text-gray-100'
            }`}
          />
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'stdio' | 'sse' | 'http')}
              className={`rounded px-2 py-1.5 text-sm ${
                light ? 'bg-white border border-gray-300 text-gray-900' : 'bg-gray-600 text-gray-100'
              }`}
            >
              <option value="stdio">stdio</option>
              <option value="sse">sse</option>
              <option value="http">http</option>
            </select>
          </div>
          {type === 'stdio' ? (
            <>
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder={t('mcp.command')}
                className={`w-full rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  light ? 'bg-white border border-gray-300 text-gray-900' : 'bg-gray-600 text-gray-100'
                }`}
              />
              <input
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder={t('mcp.args')}
                className={`w-full rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  light ? 'bg-white border border-gray-300 text-gray-900' : 'bg-gray-600 text-gray-100'
                }`}
              />
            </>
          ) : (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('mcp.url')}
              className={`w-full rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                light ? 'bg-white border border-gray-300 text-gray-900' : 'bg-gray-600 text-gray-100'
              }`}
            />
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white"
            >
              {t('mcp.add')}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className={`px-3 py-1 text-xs ${light ? 'text-gray-500' : 'text-gray-400'}`}
            >
              {t('project.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          + {t('mcp.add')}
        </button>
      )}
    </div>
  );
}

// ─── Edit MCP Form ───
//
// Edit a single MCP config. Pre-fills from the listed config (where env/headers
// values come back masked as '***') and uses the PATCH secret-omit semantics:
// keys the user didn't touch are omitted (server keeps them), entries flagged
// deleted send `null`, edited entries send the new value.

type Entry = { key: string; value: string; deleted: boolean; original: boolean };

function entriesFrom(maskedRecord: unknown): Entry[] {
  if (!maskedRecord || typeof maskedRecord !== 'object') return [];
  return Object.keys(maskedRecord as Record<string, unknown>).map(k => ({
    key: k,
    value: '',
    deleted: false,
    original: true,
  }));
}

function EditMcpForm({
  config,
  projectId,
  onSaved,
  onCancel,
}: {
  config: McpConfig;
  projectId: string;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const light = usePreferencesStore((s) => s.theme) === 'light';
  const cfg = config.config as Record<string, unknown>;
  const isStdio = config.type === 'stdio';
  const isHttpOrSse = config.type === 'sse' || config.type === 'http';

  const initialName = config.name;
  const initialCommand = typeof cfg.command === 'string' ? cfg.command : '';
  const initialArgs = Array.isArray(cfg.args) ? (cfg.args as string[]).join(', ') : '';
  const initialUrl = typeof cfg.url === 'string' ? cfg.url : '';
  const initialDescription = typeof cfg.description === 'string' ? cfg.description : '';

  const [name, setName] = useState(initialName);
  const [command, setCommand] = useState(initialCommand);
  const [args, setArgs] = useState(initialArgs);
  const [url, setUrl] = useState(initialUrl);
  const [description, setDescription] = useState(initialDescription);
  const [envEntries, setEnvEntries] = useState<Entry[]>(() => entriesFrom(cfg.env));
  const [headerEntries, setHeaderEntries] = useState<Entry[]>(() => entriesFrom(cfg.headers));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const updateEntry = (
    set: React.Dispatch<React.SetStateAction<Entry[]>>,
    idx: number,
    patch: Partial<Entry>,
  ) => set(prev => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));

  const removeEntry = (set: React.Dispatch<React.SetStateAction<Entry[]>>, idx: number) =>
    set(prev => prev.filter((_, i) => i !== idx));

  const addEntry = (set: React.Dispatch<React.SetStateAction<Entry[]>>) =>
    set(prev => [...prev, { key: '', value: '', deleted: false, original: false }]);

  const buildSecretsPatch = (entries: Entry[]): Record<string, string | null> | undefined => {
    const out: Record<string, string | null> = {};
    for (const e of entries) {
      const key = e.key.trim();
      if (!key) continue;
      if (e.original && e.deleted) {
        out[key] = null;
      } else if (!e.original && !e.deleted && e.value !== '') {
        // New entry added by the user
        out[key] = e.value;
      } else if (e.original && !e.deleted && e.value !== '') {
        // Existing entry whose value was overwritten
        out[key] = e.value;
      }
      // else: untouched original (value left blank) → omitted → server keeps it
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };

  const buildPatch = (): Record<string, unknown> => {
    const patch: Record<string, unknown> = {};
    const trimmedName = name.trim();
    if (trimmedName && trimmedName !== initialName) patch.name = trimmedName;

    if (isStdio) {
      const newCommand = command.trim();
      if (newCommand !== initialCommand) patch.command = newCommand;
      const newArgs = args.split(',').map(a => a.trim()).filter(Boolean);
      const oldArgs = Array.isArray(cfg.args) ? (cfg.args as string[]) : [];
      if (JSON.stringify(newArgs) !== JSON.stringify(oldArgs)) patch.args = newArgs;
      const envPatch = buildSecretsPatch(envEntries);
      if (envPatch) patch.env = envPatch;
    }

    if (isHttpOrSse) {
      const newUrl = url.trim();
      if (newUrl !== initialUrl) patch.url = newUrl;
      const headersPatch = buildSecretsPatch(headerEntries);
      if (headersPatch) patch.headers = headersPatch;
    }

    const newDesc = description.trim();
    if (newDesc !== initialDescription) patch.description = newDesc;

    return patch;
  };

  const handleSave = async () => {
    setError('');
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }
    setSaving(true);
    try {
      await mcpApi.update(projectId, config.id, patch);
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const inputClass = `w-full rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
    light ? 'bg-white border border-gray-300 text-gray-900' : 'bg-gray-600 text-gray-100'
  }`;
  const smallInputClass = `rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
    light ? 'bg-white border border-gray-300 text-gray-900' : 'bg-gray-600 text-gray-100'
  }`;

  const renderSecretSection = (
    heading: string,
    entries: Entry[],
    set: React.Dispatch<React.SetStateAction<Entry[]>>,
  ) => (
    <div className="space-y-1">
      <div className={`text-xs font-semibold ${light ? 'text-gray-600' : 'text-gray-400'}`}>{heading}</div>
      {entries.map((entry, idx) => (
        <div key={idx} className={`flex gap-1 items-center ${entry.deleted ? 'opacity-40 line-through' : ''}`}>
          <input
            value={entry.key}
            readOnly={entry.original}
            onChange={(e) => updateEntry(set, idx, { key: e.target.value })}
            placeholder={t('mcp.entryKey')}
            className={`${smallInputClass} flex-1 min-w-0 ${entry.original ? 'opacity-70' : ''}`}
          />
          <input
            value={entry.value}
            onChange={(e) => updateEntry(set, idx, { value: e.target.value })}
            placeholder={entry.original ? t('mcp.unchangedValue') : t('mcp.entryValue')}
            className={`${smallInputClass} flex-1 min-w-0`}
            disabled={entry.deleted}
          />
          <button
            type="button"
            onClick={() => {
              if (entry.original) {
                updateEntry(set, idx, { deleted: !entry.deleted, value: '' });
              } else {
                removeEntry(set, idx);
              }
            }}
            className={`text-xs px-1 ${entry.deleted ? 'text-green-400' : 'text-red-400'} hover:opacity-80`}
            title={entry.deleted ? 'undo' : 'remove'}
          >
            {entry.deleted ? '↶' : '×'}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => addEntry(set)}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        + {t('mcp.addEntry')}
      </button>
    </div>
  );

  return (
    <div className={`rounded p-3 mt-1 mb-2 space-y-2 ${light ? 'bg-gray-100 border border-gray-200' : 'bg-gray-800 border border-gray-700'}`}>
      <h4 className={`text-sm font-semibold ${light ? 'text-gray-800' : 'text-gray-200'}`}>
        {t('mcp.editTitle')}
      </h4>

      <div>
        <label className={`block text-xs mb-1 ${light ? 'text-gray-600' : 'text-gray-400'}`}>{t('mcp.name')}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>

      <div className={`text-xs ${light ? 'text-gray-500' : 'text-gray-500'}`}>
        {t('mcp.type')}: <span className="font-mono">{config.type}</span> · <span className="italic">{t('mcp.typeFixedHint')}</span>
      </div>

      {isStdio && (
        <>
          <div>
            <label className={`block text-xs mb-1 ${light ? 'text-gray-600' : 'text-gray-400'}`}>{t('mcp.command')}</label>
            <input value={command} onChange={(e) => setCommand(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={`block text-xs mb-1 ${light ? 'text-gray-600' : 'text-gray-400'}`}>{t('mcp.args')}</label>
            <input value={args} onChange={(e) => setArgs(e.target.value)} className={inputClass} />
          </div>
          {renderSecretSection(t('mcp.envHeading'), envEntries, setEnvEntries)}
        </>
      )}

      {isHttpOrSse && (
        <>
          <div>
            <label className={`block text-xs mb-1 ${light ? 'text-gray-600' : 'text-gray-400'}`}>{t('mcp.url')}</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className={inputClass} />
          </div>
          {renderSecretSection(t('mcp.headersHeading'), headerEntries, setHeaderEntries)}
        </>
      )}

      <div>
        <label className={`block text-xs mb-1 ${light ? 'text-gray-600' : 'text-gray-400'}`}>{t('mcp.description')}</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-white"
        >
          {t('mcp.save')}
        </button>
        <button
          onClick={onCancel}
          className={`px-3 py-1 text-xs ${light ? 'text-gray-500' : 'text-gray-400'}`}
        >
          {t('mcp.cancel')}
        </button>
      </div>
    </div>
  );
}

// ─── RAG Tab ───

function RagTab({ projectId }: { projectId: string }) {
  const theme = usePreferencesStore((s) => s.theme);
  const light = theme === 'light';

  const [settings, setSettings] = useState<RagSettings | null>(null);
  const [stats, setStats] = useState<RagStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await ragApi.get(projectId);
      setSettings(data.settings);
      setStats(data.stats);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() fetches project data on mount / projectId change
  useEffect(() => { load(); }, [projectId]);

  const handleToggle = async () => {
    if (!settings) return;
    try {
      const data = await ragApi.update(projectId, { enabled: !settings.enabled });
      setSettings(data.settings);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleAutoIndexToggle = async () => {
    if (!settings) return;
    try {
      const data = await ragApi.update(projectId, { auto_index_files: !settings.auto_index_files });
      setSettings(data.settings);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleMaxCharsChange = async (value: number) => {
    try {
      const data = await ragApi.update(projectId, { max_context_chars: value });
      setSettings(data.settings);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      await ragApi.reindex(projectId);
      setTimeout(() => {
        load();
        setReindexing(false);
      }, 2000);
    } catch (e) {
      setError((e as Error).message);
      setReindexing(false);
    }
  };

  const handleClearIndex = async () => {
    try {
      await ragApi.clearIndex(projectId);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) return <p className={`text-xs ${light ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Enable/Disable */}
      <div className={`flex items-center justify-between rounded px-3 py-2 ${light ? 'bg-gray-50' : 'bg-gray-700'}`}>
        <div>
          <p className={`text-sm font-medium ${light ? 'text-gray-900' : 'text-gray-200'}`}>Structured RAG</p>
          <p className={`text-xs ${light ? 'text-gray-400' : 'text-gray-500'}`}>
            会話とファイルから知識を抽出し、コンテキストとして注入
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`px-3 py-1 text-xs rounded ${
            settings?.enabled
              ? 'bg-green-600 text-white hover:bg-green-500'
              : light ? 'bg-gray-200 text-gray-600 hover:bg-gray-300' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
          }`}
        >
          {settings?.enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {settings?.enabled && (
        <>
          {/* Auto-index files */}
          <div className={`flex items-center justify-between rounded px-3 py-2 ${light ? 'bg-gray-50' : 'bg-gray-700'}`}>
            <div>
              <p className={`text-sm ${light ? 'text-gray-900' : 'text-gray-200'}`}>ファイル自動インデックス</p>
              <p className={`text-xs ${light ? 'text-gray-400' : 'text-gray-500'}`}>
                ワークスペースのテキストファイルを自動的にインデックス
              </p>
            </div>
            <button
              onClick={handleAutoIndexToggle}
              className={`px-3 py-1 text-xs rounded ${
                settings.auto_index_files
                  ? 'bg-green-600 text-white hover:bg-green-500'
                  : light ? 'bg-gray-200 text-gray-600 hover:bg-gray-300' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              {settings.auto_index_files ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Max context chars */}
          <div className={`rounded px-3 py-2 ${light ? 'bg-gray-50' : 'bg-gray-700'}`}>
            <p className={`text-sm mb-1 ${light ? 'text-gray-900' : 'text-gray-200'}`}>最大コンテキスト文字数</p>
            <select
              value={settings.max_context_chars}
              onChange={(e) => handleMaxCharsChange(Number(e.target.value))}
              className={`rounded px-2 py-1 text-sm ${
                light ? 'bg-white border border-gray-300 text-gray-900' : 'bg-gray-600 text-gray-100'
              }`}
            >
              <option value={2000}>2,000</option>
              <option value={4000}>4,000</option>
              <option value={8000}>8,000</option>
              <option value={16000}>16,000</option>
            </select>
          </div>

          {/* Stats */}
          {stats && (
            <div className={`rounded px-3 py-2 ${light ? 'bg-gray-50' : 'bg-gray-700'}`}>
              <p className={`text-sm font-medium mb-2 ${light ? 'text-gray-900' : 'text-gray-200'}`}>インデックス統計</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <StatBox label="エンティティ" value={stats.entity_count} light={light} />
                <StatBox label="アクション" value={stats.action_count} light={light} />
                <StatBox label="トピック" value={stats.topic_count} light={light} />
              </div>
              <p className={`text-xs mt-2 ${light ? 'text-gray-400' : 'text-gray-500'}`}>
                知識レコード: {stats.knowledge_count} / インデックス項目: {stats.index_count}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleReindex}
              disabled={reindexing}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-white"
            >
              {reindexing ? '再インデックス中...' : '再インデックス'}
            </button>
            <button
              onClick={handleClearIndex}
              className="px-3 py-1 text-xs text-red-400 hover:text-red-300"
            >
              インデックスをクリア
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value, light }: { label: string; value: number; light: boolean }) {
  return (
    <div className={`rounded px-2 py-1 ${light ? 'bg-white' : 'bg-gray-600'}`}>
      <p className={`text-lg font-semibold ${light ? 'text-gray-900' : 'text-gray-100'}`}>{value}</p>
      <p className={`text-[10px] ${light ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
    </div>
  );
}
