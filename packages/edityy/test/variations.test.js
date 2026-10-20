// Checks for the variation request and answer (src/variations.js). Run: npm test
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  VARIATION_REQUEST_FILE,
  checkVariationRequest,
  checkVariations,
  clearVariations,
  placeVariations,
  readVariationRequest,
  readVariationResponse,
  requestText,
  writeVariationRequest,
} from "../src/variations.js";

const tmp = () => mkdtempSync(join(tmpdir(), "edityy-variations-"));
const request = {
  id: "v123abc",
  count: 2,
  prompt: "  thinner and darker  ",
  element: { tag: "div", selector: "main > div.scroll", values: [{ property: "overflow-y", value: "auto" }] },
};
const answer = (variations) => ({ requestId: "v123abc", variations });

test("a request keeps its shape, and its prompt is trimmed", () => {
  const checked = checkVariationRequest(request);
  assert.equal(checked.prompt, "thinner and darker");
  assert.equal(checked.count, 2);
  assert.deepEqual(checked.element, request.element);
  // The comment is optional: a count and an element are a whole request.
  const bare = checkVariationRequest({ ...request, prompt: undefined });
  assert.equal(bare.prompt, "");
  assert.equal(checkVariationRequest({ ...request, prompt: "" }).prompt, "");
  // The page reads fifteen computed values; all of them have to fit.
  const values = Array.from({ length: 15 }, (_, i) => ({ property: "color", value: "red" + i }));
  assert.equal(checkVariationRequest({ ...request, element: { ...request.element, values } }).element.values.length, 15);
});

test("a request the page could not have sent is refused", () => {
  const bad = [
    null,
    [],
    { ...request, id: "not a valid id" },
    { ...request, id: undefined },
    { ...request, count: undefined },
    { ...request, count: 1 },
    { ...request, count: 11 },
    { ...request, count: "3" },
    { ...request, count: 2.5 },
    { ...request, prompt: "x".repeat(241) },
    { ...request, element: { ...request.element, tag: "DIV><script" } },
    { ...request, element: { ...request.element, selector: "" } },
    { ...request, element: { ...request.element, values: [{ property: "--evil", value: "x" }] } },
    { ...request, element: { ...request.element, values: [{ property: "color", value: "red;} html{display:none" }] } },
    { ...request, element: { ...request.element, values: [{ property: "color", value: "url(https://evil.example/x)" }] } },
    { ...request, element: { ...request.element, values: [{ property: "color", value: "red\n!important" }] } },
    {
      ...request,
      element: { ...request.element, values: Array.from({ length: 17 }, () => ({ property: "color", value: "red" })) },
    },
    { ...request, element: { ...request.element, values: [{ property: "color", value: "x".repeat(400) }] } },
  ];
  for (const value of bad) assert.throws(() => checkVariationRequest(value), { status: 400 }, JSON.stringify(value)?.slice(0, 60));
});

test("an answer is 2 to 5 variations of plain declarations", () => {
  const checked = checkVariations(
    answer([
      { label: " thin grey ", props: [{ property: "scrollbar-width", value: " thin " }, { property: "scrollbar-color", value: "#8a8a8a transparent" }] },
      { label: "rose pill", props: [{ property: "scrollbar-color", value: "#f43f5e #f4f4f5" }] },
    ]),
    "v123abc"
  );
  assert.deepEqual(checked.variations[0], {
    label: "thin grey",
    props: [
      { property: "scrollbar-width", value: "thin" },
      { property: "scrollbar-color", value: "#8a8a8a transparent" },
    ],
  });
});

test("a state, a pseudo-element and a breakpoint are rules, and each is checked", () => {
  const props = (declaration) => [declaration, { property: "color", value: "blue" }];
  const checked = checkVariations(
    answer([
      {
        label: "hover red",
        props: [
          { property: "background", value: "red", on: ":hover" },
          { property: "background", value: "green", on: ":focus" },
          { property: "content", value: '"→"', on: "::before" },
          { property: "padding", value: "8px", when: "(max-width: 640px)" },
          { property: "background", value: "black" },
        ],
      },
      { label: "two", props: props({ property: "background", value: "blue" }) },
    ]),
    "v123abc",
    2
  );
  assert.deepEqual(checked.variations[0].props.slice(0, 4), [
    { property: "background", value: "red", on: ":hover" },
    { property: "background", value: "green", on: ":focus" },
    { property: "content", value: '"→"', on: "::before" },
    { property: "padding", value: "8px", when: "(max-width: 640px)" },
  ]);
  // The same property on the element itself is a different declaration.
  assert.deepEqual(checked.variations[0].props[4], { property: "background", value: "black" });

  const refused = [
    { property: "color", value: "red", on: "::before{color: red}" },
    { property: "color", value: "red", on: ":hover;color:red" },
    { property: "color", value: "red", on: "HOVER" },
    { property: "color", value: "red", on: "" },
    { property: "color", value: "red", on: 1 },
    { property: "color", value: "red", when: "@media (max-width: 640px)" },
    { property: "color", value: "red", when: "(max-width: 640px) or print" },
    { property: "color", value: "red", when: "(max-width: 640px){" },
    { property: "color", value: "red", when: 640 },
  ];
  for (const declaration of refused) {
    assert.throws(
      () => checkVariations(answer([{ label: "one", props: [declaration] }, { label: "two", props: props({ property: "color", value: "blue" }) }]), "v123abc"),
      { status: 400 },
      JSON.stringify(declaration)
    );
  }
});

test("an answer that would need a stylesheet is refused", () => {
  const props = (property, value) => [{ property, value }];
  const bad = [
    answer([{ label: "one", props: props("color", "red") }]),
    answer([
      { label: "one", props: props("color", "red") },
      { label: "two", props: props("color", "blue") },
      { label: "three", props: props("color", "green") },
      { label: "four", props: props("color", "pink") },
      { label: "five", props: props("color", "black") },
      { label: "six", props: props("color", "white") },
      { label: "seven", props: props("color", "grey") },
      { label: "eight", props: props("color", "teal") },
      { label: "nine", props: props("color", "navy") },
      { label: "ten", props: props("color", "lime") },
      { label: "eleven", props: props("color", "olive") },
    ]),
    answer([
      { label: "one", props: [] },
      { label: "two", props: props("color", "blue") },
    ]),
    answer([
      { label: "one", props: props("::before", "content") },
      { label: "two", props: props("--custom", "1px") },
    ]),
    answer([
      { label: "one", props: [...props("color", "red"), ...props("color", "blue")] },
      { label: "two", props: props("color", "blue") },
    ]),
    answer([
      { label: "one", props: props("color", "#fff; background: url(x)") },
      { label: "two", props: props("box-shadow", "0 0 0 1px red !important") },
    ]),
    answer([
      { label: "", props: props("color", "red") },
      { label: "two", props: props("color", "blue") },
    ]),
    { requestId: "another", variations: answer([]).variations },
    { requestId: "v123abc", variations: "none" },
    null,
  ];
  for (const value of bad) assert.throws(() => checkVariations(value, "v123abc"), { status: 400 }, JSON.stringify(value)?.slice(0, 80));
});

test("a placed answer is read back only by the request that asked for it", async () => {
  const root = tmp();
  assert.equal(await readVariationRequest(root), null);
  await writeVariationRequest(request, root);
  assert.equal((await readVariationRequest(root)).prompt, "thinner and darker");
  assert.doesNotThrow(() => readFileSync(join(root, VARIATION_REQUEST_FILE), "utf8"));

  const placed = await placeVariations(
    answer([
      { label: "thin grey", props: [{ property: "scrollbar-width", value: "thin" }] },
      { label: "rose pill", props: [{ property: "scrollbar-color", value: "#f43f5e #f4f4f5" }] },
    ]),
    root
  );
  assert.equal(placed.variations.length, 2);
  assert.equal((await readVariationResponse("v123abc", root)).variations[1].label, "rose pill");
  assert.equal(await readVariationResponse("another", root), null, "the id has to match");

  await clearVariations(root);
  assert.equal(await readVariationRequest(root), null);
  assert.equal(await readVariationResponse("v123abc", root), null);
});

test("an answer without a request is refused, and a new request drops the old answer", async () => {
  const root = tmp();
  await assert.rejects(
    placeVariations(answer([{ label: "one", props: [{ property: "color", value: "red" }] }, { label: "two", props: [{ property: "color", value: "blue" }] }]), root),
    /no pending variation request/i
  );
  await writeVariationRequest(request, root);
  await placeVariations(answer([{ label: "one", props: [{ property: "color", value: "red" }] }, { label: "two", props: [{ property: "color", value: "blue" }] }]), root);
  await writeVariationRequest({ ...request, id: "v456def" }, root);
  assert.equal(await readVariationResponse("v123abc", root), null, "the old answer is gone");
});

test("an answer is the number of variations the user asked for, or it is refused", () => {
  const three = answer([
    { label: "one", props: [{ property: "color", value: "red" }] },
    { label: "two", props: [{ property: "color", value: "blue" }] },
    { label: "three", props: [{ property: "color", value: "green" }] },
  ]);
  assert.equal(checkVariations(three, "v123abc", 3).variations.length, 3);
  assert.throws(() => checkVariations(three, "v123abc", 2), { status: 400 }, "two asked, three placed");
});

test("the agent reads a short request, not the page", () => {
  const text = requestText(checkVariationRequest(request));
  assert.match(text, /thinner and darker/);
  assert.match(text, /vartest/, "the word the user typed in their agent");
  assert.match(text, /`main > div\.scroll` \(a `div`\)/);
  assert.match(text, /overflow-y: auto/);
  assert.match(text, /Make exactly 2 variations/);
  assert.match(text, /requestId: `v123abc`/);
  assert.match(text, /plain standard CSS properties/);
  assert.ok(text.length < 1400, `the request is short (${text.length} characters)`);
  assert.match(requestText(checkVariationRequest({ ...request, prompt: "" })), /wrote no comment/);
});
