import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BringToFront,
  Copy,
  Grid2x2,
  Image,
  ImagePlus,
  Lock,
  LockOpen,
  Minus,
  Redo2,
  Save,
  SendToBack,
  Square,
  TestTube2,
  Trash2,
  Type,
  Undo2
} from 'lucide-react';
import Canvas from '../components/Canvas';
import LayerItem from '../components/LayerItem';
import PropertiesPanel from '../components/PropertiesPanel';
import RenderModal from '../components/RenderModal';
import TemplateSizeModal from '../components/TemplateSizeModal';
import Toast from '../components/Toast';
import { API_BASE } from '../config.js';

const newId = () => `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const clone = (obj) => JSON.parse(JSON.stringify(obj));
const isTyping = (target) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [editor, setEditor] = useState({
    templateId: null,
    templateName: 'Untitled Template',
    width: 1080,
    height: 1350,
    layers: []
  });
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [dragLayerId, setDragLayerId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [renderOpen, setRenderOpen] = useState(false);
  const [renderUrl, setRenderUrl] = useState('');
  const [sizeOpen, setSizeOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const historyTimerRef = useRef(null);
  const pendingStateRef = useRef(null);
  const editorRef = useRef(editor);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(
    () => () => {
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    if (!id) {
      setEditor({
        templateId: null,
        templateName: 'Untitled Template',
        width: 1080,
        height: 1350,
        layers: []
      });
      setSelectedLayerId(null);
      setHistory({ past: [], future: [] });
      setRenderUrl('');
      setSizeOpen(true);
      setFitTrigger((x) => x + 1);
      return () => {
        cancelled = true;
      };
    }

    fetch(`${API_BASE}/api/templates/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json?.data) return;
        const t = json.data;
        setEditor({
          templateId: t.id,
          templateName: t.name || 'Loaded Template',
          width: t.width || 1080,
          height: t.height || 1350,
          layers: Array.isArray(t.layers) ? t.layers : []
        });
        setSelectedLayerId(t.layers?.[0]?.id || null);
        setHistory({ past: [], future: [] });
        setRenderUrl('');
        setSizeOpen(false);
        setFitTrigger((x) => x + 1);
      })
      .catch(() => {
        if (cancelled) return;
        setToast({ show: true, message: 'Не удалось загрузить шаблон' });
        setTimeout(() => setToast({ show: false, message: '' }), 2500);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const apply = (updater, record = true) =>
    setEditor((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!record) return next;

      // Debounce history to avoid huge stacks while dragging/typing.
      if (!pendingStateRef.current) pendingStateRef.current = prev;
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
      historyTimerRef.current = setTimeout(() => {
        const before = pendingStateRef.current;
        pendingStateRef.current = null;
        if (before) setHistory((h) => ({ past: [...h.past.slice(-50), before], future: [] }));
      }, 300);
      return next;
    });

  const layers = editor.layers;
  const selected = useMemo(() => layers.find((x) => x.id === selectedLayerId) || null, [layers, selectedLayerId]);
  const updateLayer = (idToUpdate, changes) =>
    apply((prev) => ({ ...prev, layers: prev.layers.map((x) => (x.id === idToUpdate ? { ...x, ...changes } : x)) }));
  const addLayer = (layer) => {
    apply((prev) => ({ ...prev, layers: [...prev.layers, layer] }));
    setSelectedLayerId(layer.id);
  };
  const deleteLayer = (idToDelete) => {
    apply((prev) => {
      let nextLayers = prev.layers.filter((x) => x.id !== idToDelete);
      // Re-number text variables: headline, headline2, headline3...
      let textIdx = 0;
      nextLayers = nextLayers.map((l) => {
        if (l.type === 'text' && l.text?.startsWith('{{headline')) {
          textIdx++;
          const varName = textIdx === 1 ? 'headline' : `headline${textIdx}`;
          return { ...l, text: `{{${varName}}}`, name: `{{${varName}}}` };
        }
        return l;
      });
      // Re-number image variables: imageUrl, imageUrl2, imageUrl3...
      let imgIdx = 0;
      nextLayers = nextLayers.map((l) => {
        if ((l.type === 'image' || l.type === 'logo') && l.src?.startsWith('{{image')) {
          imgIdx++;
          const varName = imgIdx === 1 ? 'imageUrl' : `imageUrl${imgIdx}`;
          return { ...l, src: `{{${varName}}}`, name: `{{${varName}}}` };
        }
        return l;
      });
      if (selectedLayerId === idToDelete) setSelectedLayerId(nextLayers[0]?.id || null);
      return { ...prev, layers: nextLayers };
    });
  };
  const duplicateLayerById = (idToClone) => {
    const layer = layers.find((x) => x.id === idToClone);
    if (!layer) return;
    addLayer({ ...clone(layer), id: newId(), name: `${layer.name || layer.id} Copy`, x: (layer.x || 0) + 20, y: (layer.y || 0) + 20 });
  };
  const duplicateSelectedLayer = () => selected && duplicateLayerById(selected.id);
  const deleteSelectedLayer = () => selected && deleteLayer(selected.id);

  const fileInputRef = useRef(null);
  const handleStaticImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      addLayer({
        id: newId(),
        name: file.name || 'Постоянное изображение',
        type: 'image',
        x: Math.round((editor.width - 200) / 2),
        y: Math.round((editor.height - 200) / 2),
        width: 200,
        height: 200,
        src: dataUrl,
        defaultImage: '',
        fit: 'contain',
        locked: true,
        visible: true,
        opacity: 100
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const nudgeSelectedLayer = (key, step) => {
    if (!selected) return;
    updateLayer(selected.id, {
      x: (selected.x || 0) + (key === 'ArrowRight' ? step : key === 'ArrowLeft' ? -step : 0),
      y: (selected.y || 0) + (key === 'ArrowDown' ? step : key === 'ArrowUp' ? -step : 0)
    });
  };
  const bringToFrontById = (idToMove) =>
    apply((prev) => {
      const found = prev.layers.find((x) => x.id === idToMove);
      if (!found) return prev;
      return { ...prev, layers: [...prev.layers.filter((x) => x.id !== idToMove), found] };
    });
  const sendToBackById = (idToMove) =>
    apply((prev) => {
      const found = prev.layers.find((x) => x.id === idToMove);
      if (!found) return prev;
      return { ...prev, layers: [found, ...prev.layers.filter((x) => x.id !== idToMove)] };
    });

  const onLayerResize = (idToResize, size) => {
    const layer = layers.find((x) => x.id === idToResize);
    if (!layer) return;
    if (!layer.lockAspect || !(layer.width > 0) || !(layer.height > 0)) {
      updateLayer(idToResize, size);
      return;
    }
    const ratio = layer.width / layer.height;
    const byWidth = Math.abs(size.width - layer.width) >= Math.abs(size.height - layer.height);
    updateLayer(idToResize, byWidth ? { width: size.width, height: Math.round(size.width / ratio) } : { width: Math.round(size.height * ratio), height: size.height });
  };

  const alignLayer = (mode) => {
    if (!selected) return;
    const w = selected.width || 120;
    const h = selected.height || 80;
    const changes =
      mode === 'left'
        ? { x: 0 }
        : mode === 'centerH'
          ? { x: Math.round((editor.width - w) / 2) }
          : mode === 'right'
            ? { x: editor.width - w }
            : mode === 'top'
              ? { y: 0 }
              : mode === 'centerV'
                ? { y: Math.round((editor.height - h) / 2) }
                : { y: editor.height - h };
    updateLayer(selected.id, changes);
  };

  const reorderLayer = (targetId, position = 'bottom') => {
    if (!dragLayerId || dragLayerId === targetId) return;
    apply((prev) => {
      const items = [...prev.layers];
      const from = items.findIndex((x) => x.id === dragLayerId);
      const to = items.findIndex((x) => x.id === targetId);
      if (from < 0 || to < 0) return prev;
      const [moved] = items.splice(from, 1);
      let insert = to + (position === 'bottom' ? 1 : 0);
      if (from < insert) insert -= 1;
      insert = Math.max(0, Math.min(items.length, insert));
      items.splice(insert, 0, moved);
      return { ...prev, layers: items };
    });
  };

  const undo = () =>
    setHistory((h) => {
      if (!h.past.length) return h;
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
      pendingStateRef.current = null;
      const prev = h.past[h.past.length - 1];
      setEditor(prev);
      return { past: h.past.slice(0, -1), future: [editorRef.current, ...h.future] };
    });

  const redo = () =>
    setHistory((h) => {
      if (!h.future.length) return h;
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
      pendingStateRef.current = null;
      const next = h.future[0];
      setEditor(next);
      return { past: [...h.past, editorRef.current], future: h.future.slice(1) };
    });

  const saveTemplate = async () => {
    const templateData = {
      id: editor.templateId || undefined,
      name: editor.templateName,
      width: editor.width,
      height: editor.height,
      layers: layers
    };

    const method = editor.templateId ? 'PUT' : 'POST';
    const url = editor.templateId
      ? `${API_BASE}/api/templates/${editor.templateId}`
      : `${API_BASE}/api/templates`;

    const resp = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateData)
    });
    const result = await resp.json();

    if (result.success && result.data?.id) {
      const savedId = result.data.id;
      setEditor((prev) => ({ ...prev, templateId: savedId }));
      if (!editor.templateId) navigate(`/templates/${savedId}/edit`);
    }

    setToast({ show: true, message: `Сохранено! ID: ${result.data?.id || '?'}` });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const onTestRender = async (payload) => {
    const { data, layers: overriddenLayers } = payload;
    const resp = await fetch(`${API_BASE}/api/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: {
          width: editor.width,
          height: editor.height,
          layers: overriddenLayers
        },
        data
      })
    });
    const blob = await resp.blob();
    setRenderUrl(URL.createObjectURL(blob));
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping(e.target)) deleteSelectedLayer();
      if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') || (e.ctrlKey && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        redo();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveTemplate();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelectedLayer();
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isTyping(e.target)) {
        e.preventDefault();
        nudgeSelectedLayer(e.key, e.shiftKey ? 10 : 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedLayerId, layers]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
      <header className="glass-panel ui-card flex h-12 items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <button
            title="Back"
            className="icon-btn h-8 w-8"
            onClick={() => navigate('/templates')}
          >
            ←
          </button>
          <div className="h-6 w-6 rounded bg-[var(--accent)]" />
          <input
            className="ui-input h-8 w-56 px-2 text-[18px]"
            value={editor.templateName}
            onChange={(e) => apply((p) => ({ ...p, templateName: e.target.value }))}
          />
        </div>
        <button title="Изменить размер шаблона" className="ui-card rounded-full bg-[var(--bg-input)] px-3 py-1 text-[12px] hover:bg-[var(--bg-panel-hover)]" onClick={() => setSizeOpen(true)}>
          {editor.width} x {editor.height}
        </button>
        <div className="flex items-center gap-2">
          <button title="Отменить (Ctrl+Z)" className="icon-btn" onClick={undo}><Undo2 size={15} /></button>
          <button title="Повторить (Ctrl+Shift+Z)" className="icon-btn" onClick={redo}><Redo2 size={15} /></button>
          <button title="Тестовый рендер" className="btn-accent flex items-center gap-1" onClick={() => setRenderOpen(true)}><TestTube2 size={14} />TEST</button>
          <button title="Сохранить шаблон (Ctrl+S)" className="btn-accent flex items-center gap-1" onClick={saveTemplate}><Save size={14} />SAVE</button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-48px)]">
        <aside className="glass-panel ui-card flex w-12 flex-col items-center gap-2 py-2">
          <button
            title="Добавить текст"
            className="icon-btn h-9 w-9"
            onClick={() => {
              const textCount = layers.filter((l) => l.type === 'text').length;
              const varName = textCount === 0 ? 'headline' : `headline${textCount + 1}`;
              addLayer({
                id: newId(),
                name: `{{${varName}}}`,
                type: 'text',
                x: 60,
                y: 200 + textCount * 120,
                width: 960,
                text: `{{${varName}}}`,
                textTransform: 'uppercase',
                fontSize: 72,
                fill: '#ffffff',
                fontFamily: 'Montserrat',
                align: 'left',
                visible: true,
                opacity: 100
              });
            }}
          >
            <Type size={16} />
          </button>
          <button title="Добавить прямоугольник" className="icon-btn h-9 w-9" onClick={() => addLayer({ id: newId(), name: 'Прямоугольник', type: 'rect', x: 120, y: 140, width: 500, height: 280, fill: '#E63946', visible: true, opacity: 100 })}><Square size={16} /></button>
          <button
            title="Добавить изображение (переменная)"
            className="icon-btn h-9 w-9"
            onClick={() => {
              const imageCount = layers.filter((l) => l.type === 'image' || l.type === 'logo').length;
              const varName = imageCount === 0 ? 'imageUrl' : `imageUrl${imageCount + 1}`;
              addLayer({
                id: newId(),
                name: `{{${varName}}}`,
                type: 'image',
                x: imageCount === 0 ? 0 : 60,
                y: imageCount === 0 ? 0 : 80,
                width: imageCount === 0 ? editor.width : 300,
                height: imageCount === 0 ? editor.height : 300,
                src: `{{${varName}}}`,
                defaultImage: '',
                fit: 'cover',
                visible: true,
                opacity: 100
              });
            }}
          >
            <Image size={16} />
          </button>
          <button
            title="Загрузить постоянную картинку (логотип и т.п.)"
            className="icon-btn h-9 w-9"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleStaticImageUpload}
          />
          <button
            title="Добавить линию"
            className="icon-btn h-9 w-9"
            onClick={() => addLayer({
              id: newId(),
              name: 'Линия',
              type: 'line',
              x1: 100,
              y1: Math.round(editor.height / 2),
              x2: editor.width - 100,
              y2: Math.round(editor.height / 2),
              stroke: '#FFFFFF',
              strokeWidth: 4,
              strokeStyle: 'solid',
              lineCap: 'round',
              fillType: 'solid',
              gradientFrom: '#FFFFFF',
              gradientTo: '#000000',
              gradientDirection: 'horizontal',
              visible: true,
              opacity: 100
            })}
          >
            <Minus size={16} />
          </button>
          <button title="Добавить градиент" className="icon-btn h-9 w-9" onClick={() => addLayer({ id: newId(), name: 'Градиент', type: 'rect', x: 0, y: 700, width: editor.width, height: 650, fillType: 'gradient', gradientDirection: 'vertical', gradientFrom: '#00000000', gradientTo: '#000000cc', visible: true, opacity: 100 })}>■</button>
          <div className="my-1 h-px w-7 bg-[var(--border)]" />
          <button title="Пресеты (скоро)" className="icon-btn h-9 w-9 opacity-40">⊞</button>
        </aside>

        <main className="relative flex-1 bg-[var(--bg-canvas-area)]">
          <Canvas
            layers={layers}
            selectedLayerId={selectedLayerId}
            templateWidth={editor.width}
            templateHeight={editor.height}
            zoom={zoom}
            fitTrigger={fitTrigger}
            showGrid={showGrid}
            onZoomChange={setZoom}
            onSelectLayer={setSelectedLayerId}
            onLayerMove={(idToMove, changes) => updateLayer(idToMove, changes)}
            onLayerResize={onLayerResize}
            onContextMenu={(idForMenu, pos) => setMenu({ id: idForMenu, ...pos })}
            onAltDuplicate={(idToClone) => duplicateLayerById(idToClone)}
          />
          <div className="glass-panel absolute bottom-3 left-3 flex items-center gap-1 rounded-lg p-1">
            <button title="Уменьшить масштаб" className="icon-btn" onClick={() => setZoom((z) => Math.max(0.1, Number((z - 0.1).toFixed(2))))}>-</button>
            <span className="px-1 text-[12px]">{Math.round(zoom * 100)}%</span>
            <button title="Увеличить масштаб" className="icon-btn" onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(2))))}>+</button>
            <button title="Вписать в экран" className="icon-btn" onClick={() => setFitTrigger((x) => x + 1)}>⊞</button>
            <button title="Показать/скрыть сетку" className={`icon-btn ${showGrid ? 'text-[var(--accent)]' : ''}`} onClick={() => setShowGrid((x) => !x)}><Grid2x2 size={14} /></button>
          </div>
        </main>

        <aside className="glass-panel ui-card flex h-full w-[280px] flex-col">
          <div className="flex h-[44%] flex-col overflow-hidden border-b border-[var(--border)]">
            <div className="px-3 py-2 text-[14px] font-semibold text-[var(--accent)]">LAYERS</div>
            <div className="flex-1 space-y-1 overflow-auto px-2 pb-2">
              {layers.map((layer) => (
                <LayerItem
                  key={layer.id}
                  layer={layer}
                  active={selectedLayerId === layer.id}
                  onSelect={() => setSelectedLayerId(layer.id)}
                  onRename={(name) => updateLayer(layer.id, { name })}
                  onToggleVisible={() => updateLayer(layer.id, { visible: layer.visible === false })}
                  onToggleLock={() => updateLayer(layer.id, { locked: !layer.locked })}
                  onDelete={() => deleteLayer(layer.id)}
                  onDragStart={setDragLayerId}
                  onDragOver={() => {}}
                  onDrop={reorderLayer}
                />
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <div className="mb-2 px-1 text-[14px] font-semibold text-[var(--accent)]">PROPERTIES</div>
            <PropertiesPanel layer={selected} onUpdate={(changes) => selected && updateLayer(selected.id, changes)} onDelete={deleteLayer} onAlign={alignLayer} />
          </div>
        </aside>
      </div>

      {menu && (
        <div className="fixed inset-0 z-40" onClick={() => setMenu(null)}>
          <div style={{ left: menu.x, top: menu.y }} className="glass-panel ui-card absolute w-44 rounded-lg p-1" onClick={(e) => e.stopPropagation()}>
            <button title="Дублировать слой" className="icon-btn w-full justify-start gap-2 px-2" onClick={() => { setSelectedLayerId(menu.id); duplicateLayerById(menu.id); setMenu(null); }}><Copy size={14} />Duplicate</button>
            <button title="Удалить слой" className="icon-btn w-full justify-start gap-2 px-2" onClick={() => { setSelectedLayerId(menu.id); deleteLayer(menu.id); setMenu(null); }}><Trash2 size={14} />Delete</button>
            <button title="На передний план" className="icon-btn w-full justify-start gap-2 px-2" onClick={() => { setSelectedLayerId(menu.id); bringToFrontById(menu.id); setMenu(null); }}><BringToFront size={14} />Bring to Front</button>
            <button title="На задний план" className="icon-btn w-full justify-start gap-2 px-2" onClick={() => { setSelectedLayerId(menu.id); sendToBackById(menu.id); setMenu(null); }}><SendToBack size={14} />Send to Back</button>
            <button title="Заблокировать/разблокировать слой" className="icon-btn w-full justify-start gap-2 px-2" onClick={() => { setSelectedLayerId(menu.id); updateLayer(menu.id, { locked: !(layers.find((x) => x.id === menu.id)?.locked) }); setMenu(null); }}>{layers.find((x) => x.id === menu.id)?.locked ? <LockOpen size={14} /> : <Lock size={14} />}{layers.find((x) => x.id === menu.id)?.locked ? 'Unlock' : 'Lock'}</button>
          </div>
        </div>
      )}

      <TemplateSizeModal
        open={sizeOpen}
        width={editor.width}
        height={editor.height}
        onClose={() => setSizeOpen(false)}
        onApply={(w, h) => {
          apply((p) => ({ ...p, width: Number(w), height: Number(h) }));
          setSizeOpen(false);
          setFitTrigger((x) => x + 1);
        }}
      />
      <RenderModal open={renderOpen} layers={layers} onClose={() => setRenderOpen(false)} onRender={onTestRender} resultUrl={renderUrl} />
      <Toast show={toast.show} message={toast.message} />
    </div>
  );
}
