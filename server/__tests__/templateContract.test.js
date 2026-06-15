import { describe, expect, it } from "vitest";
import { collectTemplateVariables, validateTemplate } from "../agent/templateContract.js";

const validTemplate = {
  id: "agent-news-cover",
  name: "Agent News Cover",
  width: 1080,
  height: 1350,
  layers: [
    {
      id: "background",
      name: "Background",
      type: "image",
      x: 0,
      y: 0,
      width: 1080,
      height: 1350,
      src: "{{imageUrl}}",
      fit: "cover"
    },
    {
      id: "shade",
      name: "Shade",
      type: "rect",
      x: 0,
      y: 720,
      width: 1080,
      height: 630,
      fillType: "gradient",
      gradientDirection: "vertical",
      gradientFrom: "#00000000",
      gradientTo: "#000000cc"
    },
    {
      id: "headline",
      name: "Headline",
      type: "text",
      x: 60,
      y: 900,
      width: 960,
      height: 220,
      text: "{{headline}}",
      fontSize: 84,
      fontFamily: "bold",
      fill: "#ffffff",
      align: "left"
    }
  ]
};

describe("template agent contract", () => {
  it("accepts a valid agent-created template", () => {
    const validation = validateTemplate(validTemplate);
    expect(validation.valid).toBe(true);
    expect(validation.meta.variables).toEqual(["headline", "imageUrl"]);
  });

  it("collects variables deeply", () => {
    expect(Array.from(collectTemplateVariables(validTemplate)).sort()).toEqual(["headline", "imageUrl"]);
  });

  it("rejects unknown layer types", () => {
    const validation = validateTemplate({
      ...validTemplate,
      layers: [{ id: "bad", type: "video", x: 0, y: 0, width: 100, height: 100 }]
    });
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "UNKNOWN_LAYER_TYPE")).toBe(true);
  });

  it("rejects duplicate layer ids", () => {
    const validation = validateTemplate({
      ...validTemplate,
      layers: [
        { ...validTemplate.layers[0], id: "same" },
        { ...validTemplate.layers[1], id: "same" }
      ]
    });
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "DUPLICATE_LAYER_ID")).toBe(true);
  });

  it("rejects invalid variable names", () => {
    const validation = validateTemplate({
      ...validTemplate,
      layers: [{ ...validTemplate.layers[2], text: "{{bad variable}}" }]
    });
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "INVALID_VARIABLE_NAME")).toBe(true);
  });
});
