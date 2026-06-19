import { describe, expect, it } from "vitest";
import { analyzeTextBinding, buildTextBindings } from "../routes/templates.js";

describe("template fit check", () => {
  const template = {
    layers: [
      {
        id: "headline",
        name: "Headline",
        type: "text",
        width: 420,
        height: 90,
        text: "{{headline}}",
        fontSize: 48,
        fontFamily: "bold",
        lineHeight: 1.1
      }
    ]
  };

  it("treats non-clipped height overflow as advisory", () => {
    const [binding] = buildTextBindings(template);
    const check = analyzeTextBinding(
      binding,
      "A long generated headline that wraps into several lines"
    );

    expect(check.heightOverflow).toBe(true);
    expect(check.strictHeight).toBe(false);
    expect(check.fits).toBe(true);
  });

  it("fails when a template declares an explicit max line limit", () => {
    const [binding] = buildTextBindings({
      layers: [{ ...template.layers[0], maxLines: 1 }]
    });
    const check = analyzeTextBinding(
      binding,
      "A long generated headline that wraps into several lines"
    );

    expect(check.lineOverflow).toBe(true);
    expect(check.declaredMaxLines).toBe(1);
    expect(check.fits).toBe(false);
  });

  it("fails clipped layers when text exceeds layer height", () => {
    const [binding] = buildTextBindings({
      layers: [{ ...template.layers[0], clipText: true }]
    });
    const check = analyzeTextBinding(
      binding,
      "A long generated headline that wraps into several lines"
    );

    expect(check.heightOverflow).toBe(true);
    expect(check.strictHeight).toBe(true);
    expect(check.fits).toBe(false);
  });
});
