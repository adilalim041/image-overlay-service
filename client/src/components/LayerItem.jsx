import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Image, Lock, Square, Trash2, Type } from 'lucide-react';

const icons = { text: Type, image: Image, logo: Image, rect: Square };

export default function LayerItem({
  layer,
  active,
  onSelect,
  onRename,
  onToggleVisible,
  onToggleLock,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(layer.name || layer.id);
  const [dropPosition, setDropPosition] = useState(null);
  const Icon = icons[layer.type] || Square;

  useEffect(() => {
    setDraft(layer.name || layer.id);
  }, [layer.id, layer.name]);

  const save = () => {
    setEditing(false);
    onRename(draft.trim() || layer.name || layer.id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setDropPosition(y < rect.height / 2 ? 'top' : 'bottom');
    onDragOver?.(layer.id);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    onDrop?.(layer.id, dropPosition || 'bottom');
    setDropPosition(null);
  };

  return (
    <div
      className={`relative ${active ? 'layer-active' : ''}`}
      draggable
      onDragStart={() => onDragStart(layer.id)}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropPosition(null)}
      onDrop={handleDrop}
      onClick={onSelect}
    >
      {dropPosition === 'top' && <div className="absolute left-0 right-0 top-0 z-10 h-[2px] bg-[var(--accent)] shadow-[0_0_6px_var(--accent-glow)]" />}

      <div className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-[var(--text-primary)] transition-all hover:bg-[var(--bg-panel-hover)]">
        <Icon size={14} className="text-[var(--text-secondary)]" />
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => event.key === 'Enter' && save()}
            className="ui-input h-6 flex-1 px-2"
          />
        ) : (
          <button title="Переименовать слой" type="button" onDoubleClick={() => setEditing(true)} className="flex-1 truncate text-left">
            {layer.name || layer.id}
          </button>
        )}

        <button title="Показать/скрыть слой" type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}>
          {layer.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button title="Заблокировать/разблокировать слой" type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); onToggleLock(); }}>
          <Lock size={14} className={layer.locked ? 'text-[var(--accent)]' : ''} />
        </button>
        <button title="Удалить слой" type="button" className="icon-btn text-[var(--danger)]" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 size={14} />
        </button>
      </div>

      {dropPosition === 'bottom' && <div className="absolute bottom-0 left-0 right-0 z-10 h-[2px] bg-[var(--accent)] shadow-[0_0_6px_var(--accent-glow)]" />}
    </div>
  );
}
