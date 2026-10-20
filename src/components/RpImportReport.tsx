import type { RpImportReport } from '../model/import-rp';
import './RpImport.css';

interface Props {
  name: string;
  report: RpImportReport;
  opened: boolean;
  onClose: () => void;
}

function IssueDetails({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2) ?? '';
  const limit = 16_000;
  return <details>
    <summary>Recovery details</summary>
    <pre>{text.slice(0, limit)}</pre>
    {text.length > limit && <small>Detail display truncated after {limit.toLocaleString()} characters.</small>}
  </details>;
}

export function RpImportReportDialog({ name, report, opened, onClose }: Props) {
  return <div className="modal-backdrop">
    <section className="rp-import-report" role="dialog" aria-modal="true" aria-labelledby="rp-import-title">
      <header><h2 id="rp-import-title">RP import report</h2><button autoFocus onClick={onClose}>Close report</button></header>
      <p><strong>{name}</strong> — partial recovery</p>
      <p>{report.pagesImported} page(s), {report.widgetsImported} recovered widget(s), {report.widgetsSkipped} skipped item(s).</p>
      <p>The counts above cover page-level widgets. Recovered panel states: {report.panelStatesImported}. Inside recovered containers: {report.nestedWidgetsImported} recovered widget(s), {report.nestedWidgetsSkipped} skipped item(s).</p>
      <p>Interactions: {report.eventsImported} recovered event(s), {report.eventsSkipped} skipped event(s), {report.casesImported} case(s), {report.actionsImported} action(s). Global variables: {report.variablesImported}.</p>
      {report.interactionTreesSkipped > 0 && <p>{report.interactionTreesSkipped} interaction tree(s) could not be decoded; their events are not included in the counts above.</p>}
      <p>{opened ? 'Recovered content is open. Save it as a new .rea.json project.' : 'No supported widgets were recovered; the current document was kept.'}</p>
      <p className="rp-import-warning">Recovery is partial. An event is skipped in full if any condition, action or target is unsupported. Native .rp write-back and full compatibility are unavailable. Review the issues below before using the recovered design.</p>
      <details><summary>Source SHA-256</summary><code>{report.sourceSha256}</code></details>
      <ol>{report.issues.slice(0, 200).map((issue, i) => <li key={i}>
        <strong>{issue.code}</strong> — {issue.message}
        {issue.sourceId && <small>Source: {issue.sourceId}</small>}
        {issue.details !== undefined && <IssueDetails value={issue.details} />}
      </li>)}</ol>
      {report.issues.length > 200 && <p>Showing the first 200 of {report.issues.length} issues.</p>}
    </section>
  </div>;
}
