import { useEffect, useState } from 'react';
import { provenanceApi, type ValidationReport } from '../../api/client';
import { usePreferencesStore } from '../../stores/preferences';
import { useT } from '../../useT';

/**
 * Provenance Validator modal (v3.2.0).
 *
 * Shows: overall pass/fail, per-gate result, list of uncited numeric claims,
 * list of [cell:...] citations that don't match any cell in the trace.
 */
export function ValidationModal({
  projectId,
  onClose,
}: { projectId: string; onClose: () => void }) {
  const t = useT();
  const light = usePreferencesStore((s) => s.theme) === 'light';
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset loading on projectId change before re-fetching
    setLoading(true);
    provenanceApi
      .validate(projectId)
      .then((r) => { if (!cancelled) { setReport(r); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [projectId]);

  const panelClass = `rounded-lg p-6 w-[640px] max-h-[85vh] overflow-y-auto ${
    light ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-100'
  }`;
  const sectionTitle = `text-sm font-semibold mt-4 mb-2 ${light ? 'text-gray-700' : 'text-gray-300'}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={panelClass}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">{t('validate.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">✕</button>
        </div>

        {loading && <p className="text-sm text-gray-400">{t('validate.loading')}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {report && !report.available && (
          <p className={`text-sm ${light ? 'text-gray-500' : 'text-gray-400'}`}>
            {t('validate.unavailable')}
          </p>
        )}

        {report && report.available && (
          <>
            <div className={`text-sm font-semibold mb-3 ${
              report.pass ? 'text-green-500' : 'text-red-500'
            }`}>
              {report.pass ? t('validate.passed') : t('validate.failed')}
            </div>

            <h3 className={sectionTitle}>{t('validate.gates')}</h3>
            <table className="w-full text-xs">
              <tbody>
                {report.gates.map((g) => (
                  <tr key={g.name} className={`border-t ${light ? 'border-gray-200' : 'border-gray-700'}`}>
                    <td className="py-1.5 align-top w-44 font-mono">
                      {g.passed ? '✓' : '✗'} {g.name}
                    </td>
                    <td className="py-1.5 align-top">
                      <div className={light ? 'text-gray-700' : 'text-gray-300'}>{g.detail}</div>
                      {g.offenders && g.offenders.length > 0 && (
                        <div className={`mt-1 text-[11px] font-mono ${light ? 'text-red-600' : 'text-red-400'}`}>
                          {g.offenders.slice(0, 8).map((o) => `[cell:${o}]`).join(' ')}
                          {g.offenders.length > 8 && ` …(+${g.offenders.length - 8})`}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className={sectionTitle}>
              {t('validate.claims')} ({report.claims.length})
            </h3>
            <div className={`text-xs ${light ? 'text-gray-600' : 'text-gray-400'}`}>
              {report.uncited_claims.length > 0 && (
                <>
                  <div className="font-semibold mb-1">
                    {t('validate.uncitedClaims')} ({report.uncited_claims.length}):
                  </div>
                  <ul className="space-y-0.5 mb-3">
                    {report.uncited_claims.slice(0, 12).map((c, i) => (
                      <li key={i} className="font-mono">
                        <span className={light ? 'text-gray-500' : 'text-gray-500'}>
                          [{c.source_file}]
                        </span>{' '}
                        <span className={light ? 'text-gray-800' : 'text-gray-200'}>{c.match}</span>
                      </li>
                    ))}
                    {report.uncited_claims.length > 12 && (
                      <li className="italic">… +{report.uncited_claims.length - 12} more</li>
                    )}
                  </ul>
                </>
              )}
              {report.unknown_citations.length > 0 && (
                <>
                  <div className="font-semibold mb-1 text-red-400">
                    {t('validate.unknownCitations')} ({report.unknown_citations.length}):
                  </div>
                  <ul className="space-y-0.5">
                    {report.unknown_citations.slice(0, 12).map((u, i) => (
                      <li key={i} className="font-mono">
                        [cell:{u.bad_cell_id}] in {u.claim.source_file} for "{u.claim.match}"
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-1.5 text-sm rounded ${
              light ? 'bg-gray-200 hover:bg-gray-300 text-gray-800' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
          >
            {t('validate.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
