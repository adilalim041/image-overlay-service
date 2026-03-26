# ПРАВИЛА ДЛЯ CODEX — Template Editor (аналог Placid)

## СТЕК
- Frontend: React + Vite + Tailwind CSS
- Canvas редактор: Fabric.js
- Backend API: Express.js (расширяем существующий Railway сервис)
- Хранение шаблонов: JSON файлы локально
- Шрифты: уже есть в /fonts/ (bold.ttf, regular.ttf)

## СТРУКТУРА ПРОЕКТА
```
template-editor/
├── client/                 # React фронтенд
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas.jsx          # Fabric.js canvas
│   │   │   ├── LayerPanel.jsx      # Панель слоёв (как в Placid)
│   │   │   ├── PropertiesPanel.jsx # Настройки выбранного слоя
│   │   │   ├── Toolbar.jsx         # Добавить текст/фото/фигуру
│   │   │   └── TemplateList.jsx    # Список сохранённых шаблонов
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── server/                 # Express backend
│   ├── server.js           # Основной сервер (наш Railway)
│   ├── routes/
│   │   ├── render.js       # POST /overlay, POST /textcard
│   │   └── templates.js    # CRUD для шаблонов
│   ├── templates/          # JSON шаблоны
│   └── fonts/              # bold.ttf, regular.ttf
└── package.json
```

## ПРАВИЛА КОДА
1. Все компоненты — функциональные React с хуками
2. Tailwind для стилей, никакого кастомного CSS если можно избежать
3. Fabric.js для canvas — никакого другого canvas решения
4. API эндпоинты всегда возвращают { success, data, error }
5. Шаблон хранится как JSON: { id, name, width, height, layers: [] }
6. Слой (layer) имеет: { id, type, x, y, width, height, ...props }
7. Типы слоёв: "text", "image", "rect", "logo"
8. НЕ использовать TypeScript — только JavaScript
9. НЕ добавлять лишние зависимости без необходимости
10. Каждый файл максимум 200 строк — разбивай на компоненты

## ТИПЫ СЛОЁВ И ИХ СВОЙСТВА
```json
// Текстовый слой
{
  "type": "text",
  "x": 60, "y": 1200,
  "width": 960, "height": 120,
  "text": "{{headline}}",        // динамическое поле из n8n
  "fontSize": 105,
  "fontFamily": "bold",          // bold | regular
  "color": "#ffffff",
  "align": "left"                // left | center | right
}

// Фото слой (фон от DALL-E/Cloudinary)
{
  "type": "image",
  "x": 0, "y": 0,
  "width": 1080, "height": 1350,
  "src": "{{imageUrl}}",         // динамическое поле из n8n
  "fit": "cover"
}

// Прямоугольник (градиент/оверлей)
{
  "type": "rect",
  "x": 0, "y": 700,
  "width": 1080, "height": 650,
  "fill": "gradient",
  "gradientFrom": "rgba(0,0,0,0)",
  "gradientTo": "rgba(0,0,0,0.9)",
  "direction": "vertical"
}

// Логотип (статичный PNG)
{
  "type": "logo",
  "x": 900, "y": 40,
  "width": 120, "height": 120,
  "src": "/assets/logo.png"
}
```

## ДИНАМИЧЕСКИЕ ПОЛЯ
Поля обёрнутые в {{}} заменяются данными из n8n при рендере:
- {{headline}} — заголовок статьи
- {{headline2}} — подзаголовок
- {{body}} — текст статьи
- {{conclusion}} — CTA текст
- {{imageUrl}} — URL картинки от DALL-E/Cloudinary

## API ЭНДПОИНТЫ
```
GET  /api/templates          — список шаблонов
GET  /api/templates/:id      — один шаблон
POST /api/templates          — создать шаблон
PUT  /api/templates/:id      — обновить шаблон
DELETE /api/templates/:id    — удалить шаблон
POST /api/render/:id         — рендер шаблона с данными
POST /overlay                — существующий эндпоинт (оставить)
POST /textcard               — существующий эндпоинт (оставить)
```

## UI/UX — КАК ДОЛЖНО ВЫГЛЯДЕТЬ
- Тёмная тема (#0f0f0f фон, #1a1a1a панели)
- Слева: список слоёв (как в Figma/Placid)
- По центру: canvas превью 1080x1350 (уменьшенный до ~400px)
- Справа: панель свойств выбранного слоя
- Сверху: toolbar (добавить слой, сохранить, тест рендер)
- Жёлтые акценты #FFD700 для активных элементов
