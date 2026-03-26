import React, { useMemo, useState } from 'react';
import { Image as ImageIcon, X, ChevronDown, ChevronUp } from 'lucide-react';

const STOCK_IMAGES = [
  'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600',
  'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600',
  'https://images.unsplash.com/photo-1555255707-c07966088b7b?w=600',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600'
];

function extractVar(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/\{\{([^}]+)\}\}/);
  return m ? m[1].trim() : null;
}

function stripBraces(str) {
  if (!str) return '';
  return str.replace(/\{\{([^}]+)\}\}/g, '$1');
}

export default function RenderModal({ open, layers, onClose, onRender, resultUrl }) {
  const [testData, setTestData] = useState({});
  const [rendering, setRendering] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  const updateLayerData = (layerId, field, value) => {
    setTestData(prev => ({
      ...prev,
      [layerId]: { ...(prev[layerId] || {}), [field]: value }
    }));
  };

  const buildRenderData = () => {
    const data = {};
    (layers || []).forEach(layer => {
      if (layer.visible === false) return;
      const overrides = testData[layer.id] || {};

      if (layer.type === 'text') {
        const varName = extractVar(layer.text);
        if (varName && overrides.text) {
          data[varName] = overrides.text;
        }
      }

      if (layer.type === 'image' || layer.type === 'logo') {
        const varName = extractVar(layer.src);
        if (varName && overrides.src) {
          data[varName] = overrides.src;
        }
      }
    });

    console.log('[TestRender] layers:', layers.map(l => ({ id: l.id, name: l.name, type: l.type, src: l.src, text: l.text?.slice(0, 30) })));
    console.log('[TestRender] testData:', testData);
    console.log('[TestRender] data to server:', data);
    return data;
  };

  const render = async () => {
    setRendering(true);
    try {
      await onRender(buildRenderData());
    } catch (e) {
      console.error('Render failed:', e);
    }
    setRendering(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-panel)] shadow-2xl"
        style={{ width: '900px', maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Левая панель */}
        <div className="overflow-auto border-r border-[var(--border-solid)] p-4" style={{ width: '400px', minWidth: '400px' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] font-bold">TEST TEMPLATE</h2>
            <button onClick={onClose} className="icon-btn"><X size={16} /></button>
          </div>

          {(layers || []).filter(l => l.visible !== false).map(layer => {
            const isCollapsed = collapsed[layer.id];
            const overrides = testData[layer.id] || {};
            const varName = extractVar(layer.type === 'text' ? layer.text : layer.src);

            return (
              <div key={layer.id} className="mb-2 rounded-lg border border-[var(--border-solid)] overflow-hidden">
                <button
                  className="flex w-full items-center justify-between bg-[var(--accent-muted)] px-3 py-1.5"
                  onClick={() => setCollapsed(p => ({ ...p, [layer.id]: !p[layer.id] }))}
                >
                  <span className="text-[12px] font-bold uppercase text-[var(--accent)]">{layer.name || layer.id}</span>
                  <div className="flex items-center gap-1">
                    {varName && <span className="text-[9px] font-mono text-[var(--text-muted)]">{`{{${varName}}}`}</span>}
                    {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="p-2.5">
                    {(layer.type === 'image' || layer.type === 'logo') && (
                      <>
                        <label className="mb-0.5 block text-[10px] text-[var(--text-secondary)]">Image</label>
                        <input
                          className="ui-input mb-1.5 w-full text-[11px]"
                          placeholder="https://..."
                          value={overrides.src || ''}
                          onChange={e => updateLayerData(layer.id, 'src', e.target.value)}
                        />
                        <label className="mb-0.5 block text-[9px] font-bold uppercase text-[var(--text-muted)]">EXAMPLES</label>
                        <div className="grid grid-cols-6 gap-1">
                          {STOCK_IMAGES.map((url, i) => (
                            <button
                              key={i}
                              className={`aspect-square overflow-hidden rounded transition-all ${overrides.src === url ? 'ring-2 ring-[var(--accent)]' : 'ring-1 ring-transparent hover:ring-[var(--border-solid)]'}`}
                              onClick={() => updateLayerData(layer.id, 'src', url)}
                            >
                              <img src={url} className="h-full w-full object-cover" alt="" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {layer.type === 'text' && (
                      <>
                        <label className="mb-0.5 block text-[10px] text-[var(--text-secondary)]">Text</label>
                        <input
                          className="ui-input w-full text-[11px]"
                          placeholder={stripBraces(layer.text) || 'text...'}
                          value={overrides.text || ''}
                          onChange={e => updateLayerData(layer.id, 'text', e.target.value)}
                        />
                      </>
                    )}

                    {layer.type === 'rect' && layer.fillType !== 'gradient' && (
                      <>
                        <label className="mb-0.5 block text-[10px] text-[var(--text-secondary)]">BG-Color</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={overrides.fill || layer.fill || '#000'} onChange={e => updateLayerData(layer.id, 'fill', e.target.value)} className="h-7 w-8 cursor-pointer rounded border-none" />
                          <input className="ui-input flex-1 text-[11px]" value={overrides.fill || layer.fill || '#000'} onChange={e => updateLayerData(layer.id, 'fill', e.target.value)} />
                        </div>
                      </>
                    )}

                    {layer.type === 'rect' && layer.fillType === 'gradient' && (
                      <div className="text-[10px] text-[var(--text-muted)]">Градиент (настраивается в редакторе)</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button className="btn-accent mt-3 w-full py-2" onClick={render} disabled={rendering}>
            {rendering ? 'Rendering...' : 'Render'}
          </button>
        </div>

        {/* Правая панель — превью */}
        <div className="flex flex-1 flex-col items-center justify-center bg-[var(--bg-canvas-area)] p-4">
          {resultUrl ? (
            <>
              <img src={resultUrl} className="max-w-full rounded-lg shadow-lg" style={{ maxHeight: '70vh' }} alt="Result" />
              <a href={resultUrl} download="render.png" className="btn-accent mt-3 inline-flex items-center gap-2 px-5 py-1.5 text-[13px]">
                ⬇ DOWNLOAD
              </a>
            </>
          ) : (
            <div className="text-center text-[var(--text-muted)]">
              <ImageIcon size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-[13px]">Заполни данные и нажми Render</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
