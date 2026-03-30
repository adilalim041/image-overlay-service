import React, { useMemo, useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  ChevronDown,
  Link2,
  Trash2
} from 'lucide-react';

const FONTS = [
  { label: 'Montserrat', value: 'Montserrat' },
  { label: 'Space Grotesk', value: 'Space Grotesk' },
  { label: 'Open Sans', value: 'Open Sans' },
  { label: 'Bebas Neue', value: 'Bebas Neue' },
  { label: 'Oswald', value: 'Oswald' },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Sans-serif', value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'monospace' }
];

function rgbaToHex(color) {
  if (typeof color !== 'string') return '#000000';
  if (color.startsWith('rgba') || color.startsWith('rgb')) {
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return `#${[m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('')}`;
  }
  if (color.startsWith('#')) return color.slice(0, 7);
  return '#000000';
}

function getAlpha(color) {
  if (typeof color !== 'string') return 1;
  if (color.startsWith('rgba')) {
    const m = color.match(/rgba?\([^)]*,\s*([\d.]+)\)/);
    return m ? Number(m[1]) : 1;
  }
  if (color.startsWith('#') && color.length === 9) return parseInt(color.slice(7, 9), 16) / 255;
  return 1;
}

function hexToRgba(hex, alpha) {
  const safe = hex.startsWith('#') ? hex : '#000000';
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${safe.slice(0, 7)}${a}`;
}

function rangeStyle(min, max, value) {
  const p = ((Number(value) - Number(min)) / (Number(max) - Number(min))) * 100;
  return { '--progress': `${Math.max(0, Math.min(100, p))}%` };
}

function snapAngle(value) {
  const n = Number(value) || 0;
  const near = Math.round(n / 45) * 45;
  return Math.abs(n - near) < 5 ? near : n;
}

function Section({ title, open, onToggle, children }) {
  return (
    <div className="ui-card rounded-lg bg-[var(--bg-input)]">
      <button className="section-header w-full" onClick={onToggle} title={`Раздел ${title}`}>
        <span>{title}</span>
        <ChevronDown size={14} className={open ? 'rotate-180 transition' : 'transition'} />
      </button>
      {open && <div className="space-y-2 px-3 pb-3">{children}</div>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] text-[var(--text-secondary)]">{label}</div>
      {children}
    </label>
  );
}

export default function PropertiesPanel({ layer, onUpdate, onDelete, onAlign }) {
  const [open, setOpen] = useState({ arrange: true, content: true, effects: false, align: true });
  const alignButtons = useMemo(
    () => [
      { id: 'left', icon: AlignLeft, title: 'По левому краю' },
      { id: 'centerH', icon: AlignCenterHorizontal, title: 'По центру горизонтально' },
      { id: 'right', icon: AlignRight, title: 'По правому краю' },
      { id: 'top', icon: AlignStartHorizontal, title: 'По верхнему краю' },
      { id: 'centerV', icon: AlignCenterVertical, title: 'По центру вертикально' },
      { id: 'bottom', icon: AlignEndHorizontal, title: 'По нижнему краю' }
    ],
    []
  );

  if (!layer) return <div className="text-[13px] text-[var(--text-secondary)]">Выберите слой</div>;
  const setNum = (key, value) => onUpdate({ [key]: Number(value) });
  const fillType = layer.fillType || (layer.fill === 'gradient' ? 'gradient' : 'solid');
  const gDir = layer.gradientDirection || 'vertical';
  const gFrom = layer.gradientFrom || '#000000ff';
  const gTo = layer.gradientTo || '#ffffffff';

  const gradientPreview = (() => {
    if (gDir === 'horizontal') return `linear-gradient(to right, ${gFrom}, ${gTo})`;
    if (gDir === 'diagonal') return `linear-gradient(135deg, ${gFrom}, ${gTo})`;
    if (gDir === 'radial') return `radial-gradient(circle, ${gFrom}, ${gTo})`;
    return `linear-gradient(to bottom, ${gFrom}, ${gTo})`;
  })();

  return (
    <div className="space-y-2 pb-2">
      <div className="ui-card rounded-lg bg-[var(--bg-input)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <input className="ui-input h-8 flex-1 px-2" value={layer.name || ''} onChange={(e) => onUpdate({ name: e.target.value })} />
          <button title="Связать пропорции" className="icon-btn" onClick={() => onUpdate({ lockAspect: !layer.lockAspect })}><Link2 size={14} className={layer.lockAspect ? 'text-[var(--accent)]' : ''} /></button>
          <button title="Удалить слой" className="icon-btn text-[var(--danger)]" onClick={() => onDelete(layer.id)}><Trash2 size={14} /></button>
        </div>
      </div>

      <Section title="ARRANGE" open={open.arrange} onToggle={() => setOpen((x) => ({ ...x, arrange: !x.arrange }))}>
        <div className="grid grid-cols-2 gap-2">
          <Field label="X"><input type="number" className="num-input w-full" value={layer.x || 0} onChange={(e) => setNum('x', e.target.value)} /></Field>
          <Field label="Y"><input type="number" className="num-input w-full" value={layer.y || 0} onChange={(e) => setNum('y', e.target.value)} /></Field>
          <Field label="W"><input type="number" className="num-input w-full" value={layer.width || 0} onChange={(e) => setNum('width', e.target.value)} /></Field>
          <Field label="H"><input type="number" className="num-input w-full" value={layer.height || 0} onChange={(e) => setNum('height', e.target.value)} /></Field>
        </div>
        <Field label="Rotation">
          <div className="grid grid-cols-[1fr_60px] gap-2">
            <input type="range" min={-180} max={180} className="slider w-full" style={rangeStyle(-180, 180, layer.rotation || 0)} value={layer.rotation || 0} onChange={(e) => setNum('rotation', e.target.value)} />
            <input type="number" className="num-input w-full" value={layer.rotation || 0} onChange={(e) => setNum('rotation', snapAngle(e.target.value))} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[var(--text-muted)]"><span>0°</span><span>90°</span><span>180°</span><span>270°</span></div>
        </Field>
        <Field label="Opacity">
          <div className="grid grid-cols-[1fr_60px] gap-2">
            <input type="range" min={0} max={100} className="slider w-full" style={rangeStyle(0, 100, layer.opacity ?? 100)} value={layer.opacity ?? 100} onChange={(e) => setNum('opacity', e.target.value)} />
            <input type="number" className="num-input w-full" value={layer.opacity ?? 100} onChange={(e) => setNum('opacity', e.target.value)} />
          </div>
        </Field>
      </Section>

      {layer.type === 'text' && (
        <Section title="TEXT" open={open.content} onToggle={() => setOpen((x) => ({ ...x, content: !x.content }))}>
          <Field label="Text"><textarea rows={4} className="ui-input w-full p-2" value={layer.text || ''} onChange={(e) => onUpdate({ text: e.target.value })} /></Field>
          <Field label="Font Family">
            <select
              className="ui-input h-8 w-full px-2"
              value={layer.fontFamily || 'sans-serif'}
              onChange={(e) => onUpdate({ fontFamily: e.target.value })}
              style={{ fontFamily: layer.fontFamily || 'sans-serif' }}
            >
              {FONTS.map((font) => (
                <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                  {font.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Font Size"><div className="grid grid-cols-[1fr_60px] gap-2"><input type="range" min={8} max={200} className="slider w-full" style={rangeStyle(8, 200, layer.fontSize || 32)} value={layer.fontSize || 32} onChange={(e) => setNum('fontSize', e.target.value)} /><input type="number" className="num-input w-full" value={layer.fontSize || 32} onChange={(e) => setNum('fontSize', e.target.value)} /></div></Field>
          <Field label="Color"><div className="grid grid-cols-[36px_1fr] gap-2"><input type="color" className="h-8 w-9 rounded-md" value={rgbaToHex(layer.fill || '#ffffff')} onChange={(e) => onUpdate({ fill: e.target.value })} /><input className="ui-input h-8 px-2" value={layer.fill || '#ffffff'} onChange={(e) => onUpdate({ fill: e.target.value })} /></div></Field>
          <Field label="Align"><div className="grid grid-cols-3 gap-2">{['left', 'center', 'right'].map((a) => <button key={a} title={`Выравнивание ${a}`} onClick={() => onUpdate({ align: a })} className={`ui-input h-8 ${layer.align === a ? 'text-[var(--accent)]' : ''}`}>{a.toUpperCase()}</button>)}</div></Field>
          <Field label="Text Transform"><div className="grid grid-cols-3 gap-2">{[{ value: 'none', label: 'Aa' }, { value: 'uppercase', label: 'AA' }, { value: 'lowercase', label: 'aa' }].map((t) => <button key={t.value} title={`Transform: ${t.value}`} onClick={() => onUpdate({ textTransform: t.value })} className={`ui-input h-8 text-[12px] font-medium ${(layer.textTransform || 'none') === t.value ? 'text-[var(--accent)]' : ''}`}>{t.label}</button>)}</div></Field>
          <Field label="Letter Spacing"><input type="range" min={-10} max={50} className="slider w-full" style={rangeStyle(-10, 50, layer.letterSpacing || 0)} value={layer.letterSpacing || 0} onChange={(e) => setNum('letterSpacing', e.target.value)} /></Field>
          <Field label="Line Height"><input type="range" min={0.8} max={3} step={0.1} className="slider w-full" style={rangeStyle(0.8, 3, layer.lineHeight || 1.1)} value={layer.lineHeight || 1.1} onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) })} /></Field>
        </Section>
      )}

      {layer.type === 'rect' && (
        <Section title="FILL" open={open.content} onToggle={() => setOpen((x) => ({ ...x, content: !x.content }))}>
          <div className="grid grid-cols-2 gap-2">
            <button
              title="Fill solid"
              className={`flex-1 rounded-md border py-1.5 text-[12px] font-medium transition-all ${
                fillType === 'solid'
                  ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                  : 'border-transparent bg-[var(--bg-input)] text-[var(--text-secondary)] hover:border-[var(--border-solid)]'
              }`}
              onClick={() =>
                onUpdate({
                  fillType: 'solid',
                  fill: layer.fill === 'gradient' ? '#E63946' : layer.fill || '#E63946'
                })
              }
            >
              solid
            </button>
            <button
              title="Fill gradient"
              className={`flex-1 rounded-md border py-1.5 text-[12px] font-medium transition-all ${
                fillType === 'gradient'
                  ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                  : 'border-transparent bg-[var(--bg-input)] text-[var(--text-secondary)] hover:border-[var(--border-solid)]'
              }`}
              onClick={() =>
                onUpdate({
                  fillType: 'gradient',
                  gradientDirection: layer.gradientDirection || 'vertical',
                  gradientFrom: layer.gradientFrom || '#000000ff',
                  gradientTo: layer.gradientTo || '#ffffffff',
                  fill: 'gradient'
                })
              }
            >
              gradient
            </button>
          </div>
          {fillType === 'solid' ? (
            <Field label="Solid Color"><input type="color" className="h-8 w-full rounded-md" value={rgbaToHex(layer.fill || '#445566')} onChange={(e) => onUpdate({ fill: e.target.value })} /></Field>
          ) : (
            <>
              <div className="h-8 w-full rounded-md border border-[var(--border-solid)]" style={{ background: gradientPreview }} />

              <div className="mb-2">
                <label className="mb-1 block text-[11px] text-[var(--text-secondary)]">Style</label>
                <div className="flex gap-1">
                  {[{ dir: 'vertical', css: 'to bottom' }, { dir: 'horizontal', css: 'to right' }, { dir: 'diagonal', css: '135deg' }, { dir: 'radial', css: null }].map(({ dir, css }) => (
                    <button key={dir} title={`Градиент: ${dir}`} className={`h-9 w-9 rounded-md border text-[14px] transition-all ${gDir === dir ? 'border-[var(--accent)] bg-[var(--accent-muted)]' : 'border-[var(--border-solid)] bg-[var(--bg-input)] hover:border-[var(--accent)]'}`} style={{ background: css ? `linear-gradient(${css}, ${gFrom}, ${gTo})` : `radial-gradient(circle, ${gFrom}, ${gTo})` }} onClick={() => onUpdate({ gradientDirection: dir })} />
                  ))}
                </div>
              </div>

              <div className="mb-2">
                <label className="text-[11px] text-[var(--text-secondary)]">From</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={rgbaToHex(gFrom)} onChange={(e) => onUpdate({ gradientFrom: hexToRgba(e.target.value, getAlpha(gFrom)) })} className="h-8 w-10 rounded border-none bg-transparent" />
                  <input type="range" min="0" max="100" value={Math.round(getAlpha(gFrom) * 100)} style={rangeStyle(0, 100, Math.round(getAlpha(gFrom) * 100))} onChange={(e) => onUpdate({ gradientFrom: hexToRgba(rgbaToHex(gFrom), Number(e.target.value) / 100) })} className="slider flex-1" title="Прозрачность" />
                  <span className="w-8 text-right text-[11px] text-[var(--text-muted)]">{Math.round(getAlpha(gFrom) * 100)}%</span>
                </div>
              </div>

              <div className="mb-2">
                <label className="text-[11px] text-[var(--text-secondary)]">To</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={rgbaToHex(gTo)} onChange={(e) => onUpdate({ gradientTo: hexToRgba(e.target.value, getAlpha(gTo)) })} className="h-8 w-10 rounded border-none bg-transparent" />
                  <input type="range" min="0" max="100" value={Math.round(getAlpha(gTo) * 100)} style={rangeStyle(0, 100, Math.round(getAlpha(gTo) * 100))} onChange={(e) => onUpdate({ gradientTo: hexToRgba(rgbaToHex(gTo), Number(e.target.value) / 100) })} className="slider flex-1" title="Прозрачность" />
                  <span className="w-8 text-right text-[11px] text-[var(--text-muted)]">{Math.round(getAlpha(gTo) * 100)}%</span>
                </div>
              </div>
            </>
          )}
          <Field label="Border"><div className="grid grid-cols-[1fr_60px_36px] gap-2"><button title="Включить/выключить обводку" className="ui-input h-8 px-2 text-left" onClick={() => onUpdate({ borderEnabled: !layer.borderEnabled })}>{layer.borderEnabled ? 'ON' : 'OFF'}</button><input type="number" className="num-input w-full" value={layer.strokeWidth || 0} onChange={(e) => setNum('strokeWidth', e.target.value)} /><input type="color" className="h-8 w-9 rounded-md" value={rgbaToHex(layer.strokeColor || '#ffffff')} onChange={(e) => onUpdate({ strokeColor: e.target.value })} /></div></Field>
          <Field label="Border Radius"><input type="range" min={0} max={500} className="slider w-full" style={rangeStyle(0, 500, layer.radius || 0)} value={layer.radius || 0} onChange={(e) => setNum('radius', e.target.value)} /></Field>
        </Section>
      )}

      {(layer.type === 'image' || layer.type === 'logo') && (
        <Section title="IMAGE" open={open.content} onToggle={() => setOpen((x) => ({ ...x, content: !x.content }))}>
          <Field label="Variable"><input className="ui-input h-8 w-full px-2" value={layer.src || '{{imageUrl}}'} onChange={(e) => onUpdate({ src: e.target.value })} /></Field>
          <Field label="Default Image URL"><input className="ui-input h-8 w-full px-2" value={layer.defaultImage || ''} onChange={(e) => onUpdate({ defaultImage: e.target.value })} /></Field>
          <Field label="Fit"><select className="ui-input h-8 w-full px-2" value={layer.fit || 'cover'} onChange={(e) => onUpdate({ fit: e.target.value })}><option value="cover">cover</option><option value="contain">contain</option><option value="fill">fill</option></select></Field>
        </Section>
      )}

      {(layer.type === 'text' || layer.type === 'image' || layer.type === 'logo') && (
        <Section title="EFFECTS" open={open.effects} onToggle={() => setOpen((x) => ({ ...x, effects: !x.effects }))}>
          <Field label="Shadow"><button title="Включить/выключить тень" className="ui-input h-8 w-full px-2 text-left" onClick={() => onUpdate({ shadowEnabled: !layer.shadowEnabled })}>{layer.shadowEnabled ? 'ON' : 'OFF'}</button></Field>
          {layer.shadowEnabled && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="X"><input type="number" className="num-input w-full" value={layer.shadowX || 0} onChange={(e) => setNum('shadowX', e.target.value)} /></Field>
              <Field label="Y"><input type="number" className="num-input w-full" value={layer.shadowY || 0} onChange={(e) => setNum('shadowY', e.target.value)} /></Field>
              <Field label="Blur"><input type="number" className="num-input w-full" value={layer.shadowBlur || 0} onChange={(e) => setNum('shadowBlur', e.target.value)} /></Field>
              <Field label="Color"><input type="color" className="h-8 w-full rounded-md" value={rgbaToHex(layer.shadowColor || '#000000')} onChange={(e) => onUpdate({ shadowColor: e.target.value })} /></Field>
            </div>
          )}
        </Section>
      )}

      <Section title="ALIGN" open={open.align} onToggle={() => setOpen((x) => ({ ...x, align: !x.align }))}>
        <div className="grid grid-cols-6 gap-1">
          {alignButtons.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} title={item.title} className="icon-btn w-full bg-[var(--bg-panel)]" onClick={() => onAlign(item.id)}><Icon size={14} /></button>;
          })}
        </div>
      </Section>
    </div>
  );
}
