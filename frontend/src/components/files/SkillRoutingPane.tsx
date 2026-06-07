import { useEffect, useState, useCallback } from 'react';
import { runsApi, type SkillRoutingRun, type SkillRoutingEvent } from '../../api/client';
import { useT } from '../../useT';

/**
 * Skill Routing log (v3.6.0).
 *
 * Shows, per run, which skills AIRA synced into the workspace ('synced') and
 * which skills the Copilot CLI actually loaded / engaged ('skills_loaded',
 * 'tool_invoked'). Lets the operator investigate why the same skill set produced
 * different agent behaviour (e.g. citation density) across runs.
 */
export function SkillRoutingPane({ projectId, light }: { projectId: string; light: boolean }) {
  const t = useT();
  const [runs, setRuns] = useState<SkillRoutingRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runsApi.skillRouting(projectId);
      setRuns(res.runs);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() sets loading state before fetching on mount / projectId change
  useEffect(() => { load(); }, [load]);

  const sub = light ? 'text-gray-500' : 'text-gray-400';
  const muted = light ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="flex flex-col flex-1 min-h-0 p-3 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-xs font-semibold uppercase ${sub}`}>
          {t('panel.skillRouting')} ({runs.length})
        </h3>
        <button
          onClick={load}
          disabled={loading}
          className={`text-xs px-2 py-0.5 rounded ${
            light ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          } disabled:opacity-50`}
        >
          ↻ {t('panel.refresh')}
        </button>
      </div>

      <p className={`text-[11px] mb-3 ${muted}`}>{t('panel.skillRoutingHint')}</p>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      {!loading && !error && runs.length === 0 && (
        <p className={`text-xs ${muted}`}>{t('panel.skillRoutingEmpty')}</p>
      )}

      <div className="space-y-2">
        {runs.map((run) => (
          <RunRouting key={run.runId} run={run} light={light} sub={sub} muted={muted} />
        ))}
      </div>
    </div>
  );
}

function RunRouting({ run, light, sub, muted }: {
  run: SkillRoutingRun;
  light: boolean;
  sub: string;
  muted: string;
}) {
  const time = run.createdAt
    ? new Date(run.createdAt.endsWith('Z') ? run.createdAt : run.createdAt + 'Z').toLocaleString([], {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '';
  return (
    <div className={`rounded p-2 text-xs ${light ? 'bg-gray-50' : 'bg-gray-800/50'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`font-mono ${muted}`}>{run.runId.slice(0, 8)}</span>
        {run.status && <span className={sub}>· {run.status}</span>}
        {time && <span className={`ml-auto ${muted}`}>{time}</span>}
      </div>
      {run.prompt && (
        <p className={`text-[11px] truncate mb-1.5 ${sub}`} title={run.prompt}>
          💬 {run.prompt.slice(0, 90)}{run.prompt.length > 90 ? '…' : ''}
        </p>
      )}
      <div className="space-y-1">
        {run.events.map((ev) => (
          <EventRow key={ev.id} ev={ev} sub={sub} muted={muted} />
        ))}
      </div>
    </div>
  );
}

const BADGE: Record<string, { label: string; cls: string }> = {
  synced: { label: 'synced', cls: 'bg-blue-600' },
  skills_loaded: { label: 'loaded', cls: 'bg-purple-600' },
  tool_invoked: { label: 'engaged', cls: 'bg-green-600' },
};

function EventRow({ ev, sub, muted }: {
  ev: SkillRoutingEvent;
  sub: string;
  muted: string;
}) {
  const badge = BADGE[ev.event_type] ?? { label: ev.event_type, cls: 'bg-gray-600' };
  return (
    <div className="flex items-start gap-1.5">
      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] text-white shrink-0 ${badge.cls}`}>
        {badge.label}
      </span>
      <span className={`flex-1 ${sub}`}>{describePayload(ev, muted)}</span>
    </div>
  );
}

function describePayload(ev: SkillRoutingEvent, muted: string): React.ReactNode {
  const p = ev.payload as Record<string, unknown> | null;
  if (ev.event_type === 'synced' && p && Array.isArray(p.skills)) {
    const skills = p.skills as Array<{ name: string; subSkills?: string[] }>;
    const routing = p.routing as
      | { applied?: boolean; domains?: string[]; selected?: number; skipped?: number }
      | undefined;
    if (skills.length === 0) return <span className={muted}>no skills assigned</span>;
    return (
      <span>
        {skills.map((s, i) => (
          <span key={i}>
            {i > 0 && ', '}
            {s.name}
            {Array.isArray(s.subSkills) && s.subSkills.length > 0 && (
              <span className={muted}> ({s.subSkills.length})</span>
            )}
          </span>
        ))}
        {routing?.applied && (
          <span className={muted}>
            {' '}— 🎯 {(routing.domains ?? []).join(', ')} · {routing.selected} selected / {routing.skipped} skipped
          </span>
        )}
      </span>
    );
  }
  if (ev.event_type === 'skills_loaded' && p && Array.isArray(p.skills)) {
    return <span>{(p.skills as string[]).join(', ')}</span>;
  }
  if (ev.event_type === 'tool_invoked' && p) {
    return (
      <span>
        {String(p.skill ?? '')}
        {p.toolName ? <span className={muted}> via {String(p.toolName)}</span> : null}
      </span>
    );
  }
  return <span className={muted}>{JSON.stringify(ev.payload)}</span>;
}
