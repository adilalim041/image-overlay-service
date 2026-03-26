import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Edit3, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { API_BASE } from '../config.js';

const API = `${API_BASE}/api/templates`;

function fmtDate(value) {
  if (!value) return 'No date';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleString();
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');

  const loadTemplates = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(API);
      const json = await resp.json();
      if (!json?.success) throw new Error(json?.error || 'Failed to load templates');
      setTemplates(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setError(e.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = [...templates].sort((a, b) => {
      const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bt - at;
    });
    if (!q) return items;
    return items.filter((x) => `${x.name || ''} ${x.id || ''}`.toLowerCase().includes(q));
  }, [search, templates]);

  const onDelete = async (id) => {
    if (!id) return;
    if (!window.confirm('Удалить шаблон?')) return;
    setBusyId(id);
    try {
      const resp = await fetch(`${API}/${id}`, { method: 'DELETE' });
      const json = await resp.json();
      if (!json?.success) throw new Error(json?.error || 'Delete failed');
      setTemplates((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      alert(e.message || 'Delete failed');
    } finally {
      setBusyId('');
    }
  };

  const onDuplicate = async (id) => {
    if (!id) return;
    setBusyId(id);
    try {
      const getResp = await fetch(`${API}/${id}`);
      const getJson = await getResp.json();
      if (!getJson?.success || !getJson?.data) throw new Error(getJson?.error || 'Load failed');
      const src = getJson.data;
      const createResp = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${src.name || 'Untitled'} Copy`,
          width: src.width,
          height: src.height,
          layers: src.layers || []
        })
      });
      const createJson = await createResp.json();
      if (!createJson?.success || !createJson?.data?.id) throw new Error(createJson?.error || 'Duplicate failed');
      await loadTemplates();
      navigate(`/templates/${createJson.data.id}/edit`);
    } catch (e) {
      alert(e.message || 'Duplicate failed');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] p-8 text-[var(--text-primary)]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-[28px] font-bold">Templates</h1>
          <div className="flex items-center gap-2">
            <button title="Refresh" onClick={loadTemplates} className="icon-btn h-10 w-10">
              <RefreshCcw size={16} />
            </button>
            <button title="Create template" onClick={() => navigate('/templates/new')} className="btn-accent inline-flex items-center gap-2 px-4 py-2 text-[14px]">
              <Plus size={16} /> Create Template
            </button>
          </div>
        </div>

        <div className="glass-panel mb-4 rounded-xl p-3">
          <input
            className="ui-input w-full"
            placeholder="Search by name or id..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading && <div className="text-[var(--text-secondary)]">Loading templates...</div>}
        {!loading && error && <div className="text-[var(--danger)]">{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="glass-panel rounded-xl p-6 text-[var(--text-secondary)]">No templates yet. Create your first one.</div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((t) => (
              <div key={t.id} className="glass-panel rounded-xl p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="line-clamp-1 text-[16px] font-semibold">{t.name || 'Untitled'}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{t.id}</div>
                  </div>
                  <div className="rounded bg-[var(--bg-input)] px-2 py-1 text-[11px] text-[var(--text-secondary)]">
                    {t.width || 1080} × {t.height || 1350}
                  </div>
                </div>

                <div className="mb-4 text-[12px] text-[var(--text-secondary)]">
                  <div>Layers: {t.layerCount || 0}</div>
                  <div>Updated: {fmtDate(t.updatedAt || t.createdAt)}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    title="Edit template"
                    onClick={() => navigate(`/templates/${t.id}/edit`)}
                    className="icon-btn h-9 w-9"
                    disabled={busyId === t.id}
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    title="Duplicate template"
                    onClick={() => onDuplicate(t.id)}
                    className="icon-btn h-9 w-9"
                    disabled={busyId === t.id}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    title="Delete template"
                    onClick={() => onDelete(t.id)}
                    className="icon-btn h-9 w-9 text-[var(--danger)]"
                    disabled={busyId === t.id}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
