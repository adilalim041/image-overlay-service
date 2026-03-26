import React, { useState } from 'react';

const presets = [
  { name: 'Instagram Post', w: 1080, h: 1080 },
  { name: 'Instagram Story', w: 1080, h: 1920 },
  { name: 'Instagram Portrait', w: 1080, h: 1350 },
  { name: 'Facebook Post', w: 1200, h: 630 },
  { name: 'Twitter/X Post', w: 1200, h: 675 },
  { name: 'YouTube Thumbnail', w: 1280, h: 720 },
  { name: 'Telegram Post', w: 1080, h: 1080 }
];

export default function TemplateSizeModal({ open, width, height, onClose, onApply }) {
  const [custom, setCustom] = useState({ width, height });
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass-panel ui-card w-full max-w-xl rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Template Size</h3>
          <button title="Закрыть" className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="grid gap-2">
          {presets.map((p) => (
            <button key={p.name} title={`Пресет ${p.name}`} className="ui-card rounded-md bg-[var(--bg-input)] px-3 py-2 text-left text-[13px] hover:bg-[var(--bg-panel-hover)]" onClick={() => onApply(p.w, p.h)}>
              {p.name} <span className="text-[var(--text-secondary)]">{p.w} x {p.h}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-[var(--bg-input)] p-3">
          <div className="mb-2 text-[11px] uppercase tracking-[1px] text-[var(--text-secondary)]">Custom</div>
          <div className="flex items-end gap-2">
            <label className="flex-1 text-[11px] text-[var(--text-secondary)]">
              Width
              <input
                type="number"
                className="ui-input mt-1 h-8 w-full px-2"
                value={custom.width}
                onChange={(e) => setCustom((x) => ({ ...x, width: Number(e.target.value) }))}
              />
            </label>
            <label className="flex-1 text-[11px] text-[var(--text-secondary)]">
              Height
              <input
                type="number"
                className="ui-input mt-1 h-8 w-full px-2"
                value={custom.height}
                onChange={(e) => setCustom((x) => ({ ...x, height: Number(e.target.value) }))}
              />
            </label>
            <button title="Применить размер" className="btn-accent h-8 px-3" onClick={() => onApply(custom.width, custom.height)}>Применить</button>
          </div>
        </div>
      </div>
    </div>
  );
}
