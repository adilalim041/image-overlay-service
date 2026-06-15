# Agent Template Workflow

Last verified: 2026-06-15

This is the machine-oriented workflow for Codex/Claude to create TemplateV1 post templates without manually using the browser editor.

## Contract

- Schema/contract endpoint: `GET /api/templates/agent/schema`
- Validation endpoint: `POST /api/templates/agent/validate`
- Offline schema: `npm run template:schema`
- Offline validation: `npm run template:validate -- path/to/template.json`
- Offline inspect: `npm run template:inspect -- path/to/template.json`
- Offline preview render: `npm run template:render -- path/to/template.json path/to/data.json path/to/output.png --strict`
- Local template save: `npm run template:save-local -- path/to/template.json`

All API calls except `/api/health` require TemplateV1 auth. Use placeholders in docs and never store real keys in files.

## Template Shape

```json
{
  "id": "agent-news-cover",
  "name": "Agent News Cover",
  "width": 1080,
  "height": 1350,
  "layers": []
}
```

Supported layer types:

- `image` / `logo`: requires `src` or `defaultImage`, plus `x`, `y`, `width`, `height`. Use `src: "{{imageUrl}}"` for dynamic article images.
- `text`: requires `text`, `fontSize`, `width`, `height`. Use variables like `{{headline}}`.
- `rect`: requires `width`, `height`; supports `fill` or `fillType: "gradient"` with `gradientFrom` / `gradientTo`.
- `line`: supports `x1`, `y1`, `x2`, `y2`, `stroke`, `strokeWidth`, and gradient fields.

Variables must match `^[A-Za-z][A-Za-z0-9_]{0,63}$`.

## Agent Loop

1. Write a complete template JSON in a temp file or `server/examples/`.
2. Run `npm run template:validate -- path/to/template.json`.
3. Fix all `severity: "error"` issues. Treat warnings as design QA prompts.
4. Render an offline preview with `npm run template:render -- path/to/template.json path/to/data.json tmp/preview.png --strict`.
5. Inspect the PNG visually before saving.
6. Save locally with `npm run template:save-local -- path/to/template.json`, or save through API with `POST /api/templates`.
7. Run saved-template fit-check after save: `POST /api/templates/:id/fit-check`.
8. Render the saved template with `POST /api/render/:templateId`.

Example:

```bash
npm run template:inspect -- examples/agent-news-cover.template.json
npm run template:validate -- examples/agent-news-cover.template.json
npm run template:render -- examples/agent-news-cover.template.json examples/agent-news-cover.data.json tmp/agent-news-cover.preview.png --strict
npm run template:save-local -- examples/agent-news-cover.template.json
```

## Design Defaults

- Instagram portrait: `1080x1350`
- Reels/stories: `1080x1920`
- Prefer 40-80 px safe margins for feed templates.
- Keep layer ids stable and semantic: `background`, `gradient-shade`, `headline`, `source-pill`.
- Put dynamic source images at the bottom of `layers`, followed by overlays, then text.
- Use `strict: true` only when final sample data includes every required variable.

## Minimal Example

```json
{
  "id": "agent-minimal-news-cover",
  "name": "Agent Minimal News Cover",
  "width": 1080,
  "height": 1350,
  "layers": [
    {
      "id": "background",
      "type": "image",
      "x": 0,
      "y": 0,
      "width": 1080,
      "height": 1350,
      "src": "{{imageUrl}}",
      "fit": "cover"
    },
    {
      "id": "gradient-shade",
      "type": "rect",
      "x": 0,
      "y": 700,
      "width": 1080,
      "height": 650,
      "fillType": "gradient",
      "gradientDirection": "vertical",
      "gradientFrom": "#00000000",
      "gradientTo": "#000000dd"
    },
    {
      "id": "headline",
      "type": "text",
      "x": 60,
      "y": 900,
      "width": 960,
      "height": 260,
      "text": "{{headline}}",
      "fontSize": 88,
      "fontFamily": "bold",
      "fill": "#ffffff",
      "align": "left",
      "lineHeight": 1.05,
      "textTransform": "uppercase"
    }
  ]
}
```
