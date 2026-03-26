# ПЕРВЫЙ ПРОМПТ ДЛЯ CODEX

Вставь это как первое сообщение в Codex:

---

Я строю визуальный редактор шаблонов для генерации изображений (аналог Placid.app). 
Прочитай файл CODEX_RULES.md — там вся архитектура, правила и структура проекта.

**Задача №1 — Инициализация проекта:**

Создай структуру проекта согласно CODEX_RULES.md:

1. Создай `client/` папку с React + Vite + Tailwind
2. Создай `server/` папку с Express
3. Установи зависимости:
   - client: react, react-dom, vite, tailwindcss, fabric
   - server: express, sharp, opentype.js, cors, uuid

4. Создай базовый `server/server.js` который:
   - Слушает порт 3000
   - Отдаёт статику из client/dist
   - Имеет заглушки для /api/templates и /api/render
   - Сохраняет существующие /overlay и /textcard эндпоинты

5. Создай базовый `client/src/App.jsx` с layout:
   - Левая панель 280px (список слоёв)
   - Центр (canvas)
   - Правая панель 320px (свойства)
   - Верхний toolbar 56px
   - Тёмная тема

6. Создай `client/src/components/Canvas.jsx` с Fabric.js:
   - Инициализация canvas 400x533px (пропорции 1080x1350)
   - Отображение слоёв из state
   - Выделение слоя по клику

После создания покажи структуру файлов и содержимое каждого.

---
