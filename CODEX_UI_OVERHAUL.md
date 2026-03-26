# CODEX PROMPT: Template Editor — UI Overhaul + Fixes

> **Роль**: Ты senior frontend-разработчик. Выполни ВСЕ задачи ниже за один проход.
> **Стек**: React + Vite + Tailwind CSS + Fabric.js (client/) + Express (server/)
> **Правило**: После каждого блока изменений — `cd client && npm run build` должен проходить без ошибок.
> **Стиль кода**: TypeScript не нужен. JSX + ES6. Комментарии на русском.

---

## 0. ДИЗАЙН-СИСТЕМА (применить КО ВСЕМ компонентам)

### Цветовая палитра (CSS-переменные в index.css или App.css)
```css
:root {
  /* Основные */
  --bg-app: #0F0F12;           /* Фон приложения — почти чёрный с синевой */
  --bg-panel: #1A1A24;         /* Панели (layers, properties) */
  --bg-panel-hover: #22222E;   /* Ховер в панелях */
  --bg-input: #12121A;         /* Инпуты, слайдеры */
  --bg-canvas-area: #16161E;   /* Зона за canvas */

  /* Акценты */
  --accent: #7C5CFC;           /* Основной акцент — фиолетовый */
  --accent-hover: #9B7FFF;     /* Ховер акцента */
  --accent-muted: rgba(124, 92, 252, 0.15); /* Подсветка активного слоя */
  --accent-glow: rgba(124, 92, 252, 0.3);   /* Glow эффекты */

  /* Текст */
  --text-primary: #E8E8F0;     /* Основной текст */
  --text-secondary: #8888A0;   /* Вторичный */
  --text-muted: #555568;       /* Плейсхолдеры */

  /* Утилиты */
  --border: #2A2A3A;           /* Разделители */
  --danger: #FF4D6A;           /* Удаление */
  --success: #4ADE80;          /* Сохранено */
  --warning: #FBBF24;          /* Предупреждения */
  --snap-line: #7C5CFC;        /* Snap-линии (фиолетовые, не красные) */
}
```

### Типографика
- Загрузи Google Fonts в index.html:
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  ```
- `font-family: 'Plus Jakarta Sans', system-ui, sans-serif` — для всего UI
- Размеры: 11px для меток, 12px для инпутов, 13px для текста панелей, 14px для заголовков секций, 18px для названия шаблона

### Общие UI-правила
- Border-radius: 6px для кнопок и инпутов, 8px для карточек/панелей, 12px для модалок
- Тени: `box-shadow: 0 0 0 1px var(--border)` вместо border (тоньше)
- Transition: `all 0.15s ease` на всех интерактивных элементах
- Инпуты: тёмный фон `var(--bg-input)`, без видимой рамки, при фокусе — `box-shadow: 0 0 0 1px var(--accent)`
- Кнопки-иконки: 28×28px, border-radius: 6px, hover: `var(--bg-panel-hover)`
- Активный слой в списке: фон `var(--accent-muted)`, левая полоска 2px `var(--accent)`
- Скроллбары: тонкие (6px), цвет `var(--border)`, скруглённые

---

## 1. CANVAS — RESIZE БЕЗ ФИКСАЦИИ ПРОПОРЦИЙ

**Файл: `Canvas.jsx`**

Текущее поведение: при resize за угол пропорции зафиксированы.
Нужное поведение: свободный resize по умолчанию, Shift фиксирует пропорции.

Для каждого Fabric.js объекта на canvas:
```js
// При создании/добавлении объекта:
obj.set({
  lockUniScaling: false,        // Разрешить свободный resize
  uniformScaling: false,         // НЕ фиксировать пропорции по умолчанию
});

// Глобально на canvas:
canvas.uniformScaling = false;   // Свободный resize по умолчанию
// Fabric.js автоматически переключает на uniform когда зажат Shift
```

Убедись что это применяется ко ВСЕМ типам объектов (text, rect, image).

---

## 2. CANVAS — УБРАТЬ "ПЛАНШЕТ", СДЕЛАТЬ РАМКУ

**Файл: `Canvas.jsx`**

Текущее поведение: canvas показывается в каком-то контейнере/планшете.
Нужное поведение:
- Canvas-зона — это `var(--bg-canvas-area)` фон
- Шаблон (рабочая область) — белый/прозрачный прямоугольник с тонкой рамкой `1px solid var(--border)`
- Объекты которые выходят за границы шаблона — ВИДНЫ, но визуально за рамкой (clipPath НЕ обрезает на canvas, обрезка только при рендере)
- Snap-линии также привязываются к границам шаблона (0, width, height, center)

Реализация:
```js
// Фоновый прямоугольник шаблона (не выделяемый):
const border = new fabric.Rect({
  left: 0, top: 0,
  width: templateWidth, height: templateHeight,
  fill: '#ffffff',        // или прозрачный если нужно
  stroke: 'var(--border)', // или '#2A2A3A'
  strokeWidth: 1,
  selectable: false,
  evented: false,
  excludeFromExport: true,
  name: '__templateBorder'
});
canvas.add(border);
canvas.sendToBack(border);
```

Canvas сам по себе должен быть БОЛЬШЕ чем шаблон (чтобы было место вокруг для drag-out).

---

## 3. НАСТРОЙКА РАЗМЕРА ШАБЛОНА

**Файл: `App.jsx` + новый компонент `TemplateSizeModal.jsx`**

Добавить в верхний toolbar кнопку с текущим размером (например "1080 × 1350").
По клику — модалка или dropdown:

```jsx
// TemplateSizeModal.jsx
const presets = [
  { name: 'Instagram Post', w: 1080, h: 1080 },
  { name: 'Instagram Story', w: 1080, h: 1920 },
  { name: 'Instagram Portrait', w: 1080, h: 1350 },
  { name: 'Facebook Post', w: 1200, h: 630 },
  { name: 'Twitter/X Post', w: 1200, h: 675 },
  { name: 'YouTube Thumbnail', w: 1280, h: 720 },
  { name: 'Telegram Post', w: 1080, h: 1080 },
];

// UI: список пресетов + кастомные поля Width / Height с кнопкой "Применить"
// При смене размера:
// 1. Обновить state templateWidth, templateHeight
// 2. Пересоздать border-прямоугольник на canvas
// 3. НЕ масштабировать существующие слои (просто меняется рабочая область)
```

Стиль модалки: тёмный фон `var(--bg-panel)`, скруглённые углы 12px, backdrop blur.

---

## 4. ZOOM (МАСШТАБИРОВАНИЕ)

**Файл: `Canvas.jsx` + зона управления в `App.jsx`**

### Кнопки
В нижнем левом углу canvas-зоны (как у Placid на скрине):
```jsx
<div className="zoom-controls">
  <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}>−</button>
  <span>{Math.round(zoom * 100)}%</span>
  <button onClick={() => setZoom(z => Math.min(3, z + 0.1))}>+</button>
  <button onClick={fitToScreen}>⊞</button>  {/* Fit to screen */}
</div>
```

### Колёсико мыши
- `Shift + Wheel` = zoom in/out (вокруг курсора)
- Без Shift — обычный скролл (если canvas-зона скроллится) или pan

```js
canvas.on('mouse:wheel', function(opt) {
  if (opt.e.shiftKey) {
    const delta = opt.e.deltaY;
    let newZoom = canvas.getZoom() * (1 - delta / 500);
    newZoom = Math.min(3, Math.max(0.1, newZoom));
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, newZoom);
    opt.e.preventDefault();
    opt.e.stopPropagation();
    setZoom(newZoom); // синхронизировать React state
  }
});
```

### Fit to Screen
При загрузке и по кнопке: вычислить zoom чтобы шаблон помещался в canvas-зону с отступом 40px с каждой стороны.

---

## 5. КНОПКИ ВЫРАВНИВАНИЯ — ПЕРЕНЕСТИ В ПАНЕЛЬ

**Удалить**: `AlignmentTools.jsx` компонент из canvas-зоны (кнопки L, CH, R, T, CV, B которые сейчас плавают над canvas).

**Добавить**: Секцию "ALIGN" в `PropertiesPanel.jsx` — показывать только когда выбран объект.

```jsx
// В PropertiesPanel, новая секция:
<div className="section">
  <div className="section-header">ALIGN</div>
  <div className="align-buttons">
    {/* 6 кнопок в ряд, используй SVG иконки или lucide-react */}
    <button title="Align Left" onClick={() => alignLayer('left')}>
      <AlignLeft size={16} />
    </button>
    <button title="Center Horizontally" onClick={() => alignLayer('centerH')}>
      <AlignCenterHorizontal size={16} />
    </button>
    <button title="Align Right" onClick={() => alignLayer('right')}>
      <AlignRight size={16} />
    </button>
    <button title="Align Top" onClick={() => alignLayer('top')}>
      <AlignStartVertical size={16} />
    </button>
    <button title="Center Vertically" onClick={() => alignLayer('centerV')}>
      <AlignCenterVertical size={16} />
    </button>
    <button title="Align Bottom" onClick={() => alignLayer('bottom')}>
      <AlignEndVertical size={16} />
    </button>
  </div>
</div>
```

Выравнивание — относительно границ шаблона (templateWidth, templateHeight), НЕ относительно canvas.

---

## 6. SNAP-ЛИНИИ — ОБНОВИТЬ СТИЛЬ

**Файл: `Canvas.jsx`**

- Цвет snap-линий: `var(--snap-line)` → `#7C5CFC` (фиолетовый, не красный)
- Толщина: 1px
- Стиль: dashed (strokeDashArray: [4, 4])
- Добавить snap к другим объектам (не только к краям шаблона):
  - Snap к left/right/top/bottom/centerX/centerY каждого другого объекта
  - Порог: 8px

---

## 7. KEYBOARD SHORTCUTS

**Файл: `App.jsx`** (useEffect с keydown listener)

```js
useEffect(() => {
  const handler = (e) => {
    // Delete/Backspace — удалить выбранный слой (если не в инпуте)
    if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      deleteSelectedLayer();
    }
    // Ctrl+Z — Undo
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    // Ctrl+Shift+Z или Ctrl+Y — Redo
    if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) { e.preventDefault(); redo(); }
    // Ctrl+S — Save
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveTemplate(); }
    // Ctrl+D — Duplicate слой
    if (e.ctrlKey && e.key === 'd') { e.preventDefault(); duplicateSelectedLayer(); }
    // Стрелки — nudge на 1px (Shift+стрелки = 10px)
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      nudgeSelectedLayer(e.key, step);
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [/* нужные зависимости */]);
```

Реализуй функции `duplicateSelectedLayer()` и `nudgeSelectedLayer(direction, step)`.

---

## 8. UI LAYOUT — ПЕРЕСТРОИТЬ КАК У PLACID

### Общая структура (App.jsx):
```
┌──────────────────────────────────────────────────────────┐
│ TOP BAR (h: 48px)                                        │
│ [logo] [name ✏️]        [↶ Undo] [↷ Redo]  [TEST] [SAVE]│
├────────┬─────────────────────────────────┬───────────────┤
│ LEFT   │                                 │ RIGHT PANEL   │
│ SIDEBAR│       CANVAS AREA               │ (280px)       │
│ (48px) │       var(--bg-canvas-area)     │               │
│        │                                 │ LAYERS        │
│ icons: │       ┌─────────────┐           │ section       │
│ [T]    │       │  Template   │           │               │
│ [□]    │       │  (рамка)    │           │ ───────────── │
│ [🖼]   │       │             │           │ PROPERTIES    │
│ [■]    │       └─────────────┘           │ section       │
│ [▦]    │                                 │ (ARRANGE,     │
│        │  zoom: [- 67% + ⊞]             │  FILL, TEXT,  │
│        │                                 │  ALIGN...)    │
├────────┴─────────────────────────────────┴───────────────┤
│ (опционально: bottom status bar)                         │
└──────────────────────────────────────────────────────────┘
```

### Left Sidebar (48px шириной)
Вертикальная полоска с иконками для добавления элементов:
- `T` — Add Text
- `□` — Add Rectangle
- `🖼` — Add Image
- `■` — Add Gradient Rect
- (разделитель)
- `⊞` — Add from presets (будущее)

Каждая иконка: 36×36px, tooltip справа, hover: `var(--bg-panel-hover)`
Фон сайдбара: `var(--bg-panel)`

### Top Bar (48px)
- Слева: логотип/иконка + название шаблона (editable, клик → input)
- По центру: размер шаблона (клик → TemplateSizeModal). Показывать как pill: `1080 × 1350`
- Справа: `[↶] [↷]` + `[🔍 TEST]` кнопка accent + `[💾 SAVE]` кнопка accent

Стиль кнопок TEST и SAVE:
```css
.btn-accent {
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 16px;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-accent:hover {
  background: var(--accent-hover);
  box-shadow: 0 0 12px var(--accent-glow);
}
```

### Right Panel (280px)
Разделить на 2 секции с возможностью скролла:

**Верх — LAYERS:**
- Заголовок "LAYERS" с accent цветом
- Список слоёв (drag-and-drop для reorder)
- Каждый слой: иконка типа + имя + [👁 visibility] [🔒 lock] [🗑 delete]
- Активный: фон `var(--accent-muted)`, левая полоска `var(--accent)`
- Double-click для rename

**Низ — PROPERTIES (если выбран слой):**
- Collapsible секции: ARRANGE, FILL/IMAGE/TEXT (по типу), EFFECTS, ALIGN
- Каждая секция: заголовок accent цветом + chevron для collapse

### Properties Panel секции (по типу слоя):

**Для ВСЕХ типов — секция ARRANGE:**
- Position: X ▢ Y ▢ (инпуты рядом)
- Size: W ▢ H ▢ + 🔗 lock aspect toggle
- Rotation: slider + число
- Opacity: slider + число (0-100%)

**Для TEXT — секция TEXT:**
- Textarea для текста (с поддержкой {{переменных}})
- Font Family: dropdown
- Font Size: slider + число
- Color: color picker circle + hex input
- Align: [L] [C] [R] кнопки-переключатели
- Letter Spacing: slider
- Line Height: slider

**Для RECT — секция FILL:**
- Toggle: [Solid] [Gradient] — pill-переключатель
- Solid: color picker + hex
- Gradient: direction dropdown (vertical/horizontal/diagonal) + From color + To color
- Border: toggle ON/OFF + width slider + color
- Border Radius: slider

**Для IMAGE — секция IMAGE:**
- Превью текущей картинки (маленький thumbnail)
- Fit: dropdown [cover / contain / fill]
- "Replace Image" кнопка
- Default Image URL input (для {{переменных}})

**Секция ALIGN** (для всех типов, когда выбран):
- 6 кнопок в ряд (см. пункт 5 выше)

**Секция EFFECTS** (для text и image):
- Shadow: toggle + X/Y/Blur/Color
- (будущее: blur, opacity animation)

### Стиль инпутов в Properties:
```css
/* Числовой инпут */
.num-input {
  background: var(--bg-input);
  color: var(--text-primary);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  width: 60px;
  font-size: 12px;
  font-family: 'Plus Jakarta Sans', sans-serif;
}
.num-input:focus {
  outline: none;
  box-shadow: 0 0 0 1px var(--accent);
}

/* Slider */
.slider {
  -webkit-appearance: none;
  background: var(--bg-input);
  height: 4px;
  border-radius: 2px;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}

/* Секция */
.section-header {
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  padding: 12px 16px 8px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

---

## 9. TOAST И МОДАЛКИ — ОБНОВИТЬ СТИЛЬ

**Toast.jsx:**
- Позиция: bottom-center (не top-right)
- Стиль: `var(--bg-panel)` фон, border `var(--accent)`, текст `var(--text-primary)`
- Slide-up анимация
- Иконка: ✓ для success, ⚠ для warning

**RenderModal.jsx:**
- Backdrop: rgba(0,0,0,0.7) с backdrop-filter: blur(8px)
- Модалка: `var(--bg-panel)` фон, border-radius: 12px
- Кнопка Render: accent стиль
- Поля для тестовых данных: показывать список всех `{{переменных}}` из шаблона, для каждой — input

---

## 10. ДОПОЛНИТЕЛЬНЫЕ УЛУЧШЕНИЯ

### Context Menu (правый клик на объекте):
```jsx
// Пункты:
// - Duplicate (Ctrl+D)
// - Delete (Del)
// - Bring to Front
// - Send to Back
// - Lock/Unlock
```
Стиль: тёмный dropdown, accent на hover.

### Grid Toggle
Кнопка в toolbar или рядом с zoom:
- Показать/скрыть сетку (20×20px, цвет `var(--border)` с opacity 0.3)
- Grid не влияет на snap (snap работает отдельно)

---

## 11. ЧЕКЛИСТ ПЕРЕД ЗАВЕРШЕНИЕМ

- [ ] `cd client && npm run build` — успешно
- [ ] Все CSS-переменные определены в одном месте (index.css)
- [ ] Google Font подключен в index.html
- [ ] Нет console.error в браузере
- [ ] Resize объектов — свободный по умолчанию, Shift = lock ratio
- [ ] Canvas показывает рамку шаблона, объекты видны за границами
- [ ] Размер шаблона можно менять
- [ ] Zoom работает (кнопки + Shift+Wheel)
- [ ] Выравнивание — в правой панели, не на canvas
- [ ] Snap-линии фиолетовые
- [ ] Keyboard shortcuts работают (Del, Ctrl+Z/Y/S/D, стрелки)
- [ ] UI выглядит как современный тёмный редактор (не "деревянный")
- [ ] Все кнопки, инпуты, панели используют дизайн-систему из пункта 0

---

## ВАЖНО

- НЕ меняй логику сохранения/загрузки шаблонов (JSON формат остаётся)
- НЕ меняй серверные эндпоинты (POST /api/render, CRUD /api/templates)
- НЕ удаляй существующие features, только улучшай
- Используй lucide-react для иконок (если не установлен — `npm install lucide-react`)
- Все новые компоненты создавай в `client/src/components/`
