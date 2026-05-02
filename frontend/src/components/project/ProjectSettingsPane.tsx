import { useEffect, useState } from 'react';
import { skillsApi, mcpApi, type Skill, type McpConfig } from '../../api/client';
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
  const [tab, setTab] = useState<'skills' | 'mcp'>('skills');

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
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
        </div>

        {tab === 'skills' ? (
          <SkillsTab projectId={projectId} />
        ) : (
          <McpTab projectId={projectId} />
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
  const [name, setName] = useState('');
  const [type, setType] = useState<'stdio' | 'sse'>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setConfigs(await mcpApi.list(projectId));
  };

  useEffect(() => { load(); }, [projectId]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setError('');
    try {
      const config: Record<string, unknown> = type === 'stdio'
        ? { command: command.trim(), args: args.split(',').map((a) => a.trim()).filter(Boolean) }
        : { url: url.trim() };

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
          <div key={cfg.id} className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
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
              onChange={(e) => setType(e.target.value as 'stdio' | 'sse')}
              className={`rounded px-2 py-1.5 text-sm ${
                light ? 'bg-white border border-gray-300 text-gray-900' : 'bg-gray-600 text-gray-100'
              }`}
            >
              <option value="stdio">stdio</option>
              <option value="sse">sse</option>
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
