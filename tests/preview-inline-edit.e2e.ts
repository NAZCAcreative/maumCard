import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";

const cardPayload = {
  name: "",
  bg: "flower",
  recipient_label: "",
  ai_compose: false,
  content_font: "pen",
  content_color: "#4a2412",
  content_box: { x0: 0.15, y0: 0.3, x1: 0.85, y1: 0.7 },
};

test("preview background endpoint returns a text-free card background", async ({ request }) => {
  const [response, otherTextResponse] = await Promise.all([
    request.post("http://localhost:3003/api/card-image", {
      data: { ...cardPayload, message: "표시되면 안 되는 문구", background_only: true },
    }),
    request.post("http://localhost:3003/api/card-image", {
      data: { ...cardPayload, message: "완전히 다른 문구", background_only: true },
    }),
  ]);

  expect(response.ok()).toBeTruthy();
  expect(otherTextResponse.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toBe("image/png");
  expect(response.headers()["x-render-mode"]).toBe("background-only");
  const background = await response.body();
  const otherTextBackground = await otherTextResponse.body();
  expect(background.byteLength).toBeGreaterThan(1000);
  expect(createHash("sha256").update(background).digest("hex"))
    .toBe(createHash("sha256").update(otherTextBackground).digest("hex"));
});

test("card image renderer preserves an explicit line break", async ({ request }) => {
  const [lineBreakResponse, spaceResponse] = await Promise.all([
    request.post("http://localhost:3003/api/card-image", {
      data: { ...cardPayload, message: "첫 줄\n둘째 줄" },
    }),
    request.post("http://localhost:3003/api/card-image", {
      data: { ...cardPayload, message: "첫 줄 둘째 줄" },
    }),
  ]);

  expect(lineBreakResponse.ok()).toBeTruthy();
  expect(spaceResponse.ok()).toBeTruthy();
  expect(lineBreakResponse.headers()["content-type"]).toBe("image/png");

  const lineBreakImage = await lineBreakResponse.body();
  const spaceImage = await spaceResponse.body();
  const hash = (image: Buffer) => createHash("sha256").update(image).digest("hex");

  expect(hash(lineBreakImage)).not.toBe(hash(spaceImage));
});

test("card image renderer applies the latest title", async ({ request }) => {
  const [beforeResponse, afterResponse] = await Promise.all([
    request.post("http://localhost:3003/api/card-image", {
      data: { ...cardPayload, recipient_label: "수정 전 제목", message: "같은 본문" },
    }),
    request.post("http://localhost:3003/api/card-image", {
      data: { ...cardPayload, recipient_label: "수정 후 제목", message: "같은 본문" },
    }),
  ]);

  expect(beforeResponse.ok()).toBeTruthy();
  expect(afterResponse.ok()).toBeTruthy();
  const hash = (image: Buffer) => createHash("sha256").update(image).digest("hex");
  expect(hash(await beforeResponse.body())).not.toBe(hash(await afterResponse.body()));
});

test("card image renderer applies title and footer edits together", async ({ request }) => {
  const response = await request.post("http://localhost:3003/api/card-image", {
    data: {
      ...cardPayload,
      recipient_label: "최종 제목",
      message: "같은 본문",
      sub_text: "최종 보내는 사람",
      title_box: { x0: 0.2, y0: 0.15, x1: 0.8, y1: 0.28 },
      footer_box: { x0: 0.45, y0: 0.72, x1: 0.85, y1: 0.82 },
    },
  });

  expect(response.ok()).toBeTruthy();
  const metrics = JSON.parse(decodeURIComponent(response.headers()["x-card-text-metrics"]));
  expect(metrics.titleSize).toBeGreaterThan(0);
  expect(metrics.footerSize).toBeGreaterThan(0);
});

test("contenteditable Enter stays at the cursor and is stored as a newline", async ({ page }) => {
  await page.setContent(`<div id="editor" contenteditable>첫 줄셋째 줄</div>`);
  const editor = page.locator("#editor");
  await editor.focus();
  await page.evaluate(() => {
    const editor = document.querySelector("#editor");
    const textNode = editor?.firstChild;
    if (!textNode) throw new Error("text node not found");
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(textNode, 3);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const lineBreak = document.createElement("br");
    const caretAnchor = document.createTextNode("\u200b");
    range.insertNode(lineBreak);
    lineBreak.after(caretAnchor);
    range.setStartAfter(caretAnchor);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await editor.pressSequentially("둘째 줄");

  const text = await editor.evaluate((element) => {
    const readChildren = (parent: Node): string => {
      let result = "";
      for (const node of Array.from(parent.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          result += node.textContent ?? "";
          continue;
        }
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName === "BR") {
          result += "\n";
          continue;
        }
        const isBlock = node.tagName === "DIV" || node.tagName === "P";
        if (isBlock && result && !result.endsWith("\n")) result += "\n";
        result += readChildren(node);
        if (isBlock && node.nextSibling && !result.endsWith("\n")) result += "\n";
      }
      return result;
    };
    return readChildren(element).replace(/\u200b/g, "").replace(/\u00a0/g, " ").replace(/^\n|\n$/g, "");
  });

  expect(text).toBe("첫 줄\n둘째 줄셋째 줄");
});
