import { useRef, useState, type ChangeEvent } from 'react';
import { api, errorMessage } from '../services/api';
import type { Notice } from '../types';
import { downloadFile, formatBackupAsText, validateBackup } from '../utils/backup';
import { todayISO } from '../utils/date';

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

interface ImportExportProps {
  onImported: () => void;
  notify: (notice: Notice) => void;
}

export default function ImportExport({ onImported, notify }: ImportExportProps) {
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleExport = async (format: 'json' | 'text') => {
    setBusy(true);
    try {
      const backup = await api.exportAll();
      const stamp = todayISO();
      if (format === 'json') {
        downloadFile(`daily-companion-${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json');
      } else {
        downloadFile(`daily-companion-${stamp}.txt`, formatBackupAsText(backup), 'text/plain');
      }
      notify({ type: 'success', text: `Exported ${backup.entries.length} entries.` });
    } catch (err) {
      notify({ type: 'error', text: `Export failed: ${errorMessage(err)}` });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again
    if (!file) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFileText(file));
    } catch {
      notify({ type: 'error', text: 'Import failed: the file is not valid JSON. No data was changed.' });
      return;
    }
    const check = validateBackup(parsed);
    if (!check.ok) {
      notify({ type: 'error', text: `Import failed: ${check.error} No data was changed.` });
      return;
    }
    const confirmed = window.confirm(
      `Import ${check.entries.length} entries from "${file.name}"?\n\nExisting entries with the same dates will be replaced.`,
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const result = await api.importBackup(check.entries);
      notify({ type: 'success', text: result.message });
      onImported();
    } catch (err) {
      notify({ type: 'error', text: `Import failed: ${errorMessage(err)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="import-export" aria-label="Import and export">
      <button type="button" className="button" disabled={busy} onClick={() => handleExport('json')}>
        Export as JSON
      </button>
      <button type="button" className="button" disabled={busy} onClick={() => handleExport('text')}>
        Export as Text
      </button>
      <button type="button" className="button" disabled={busy} onClick={() => fileInput.current?.click()}>
        Import Data
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        aria-label="Choose a JSON backup file to import"
        tabIndex={-1}
        onChange={handleFile}
      />
    </section>
  );
}
