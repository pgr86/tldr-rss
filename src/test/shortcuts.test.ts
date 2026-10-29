import {
  renderShortcutDialog,
  SHORTCUT_GROUPS,
  shortcutHint,
  tip,
} from "../shortcuts";

const LABELS = [
  "Nächster Artikel",
  "Vorheriger Artikel",
  "Artikel weiterscrollen, am Ende nächster",
  "Artikel zurückscrollen",
  "Im Reader öffnen",
  "Reader schließen",
  "Original im Browser öffnen",
  "Gelesen / ungelesen",
  "Merken / nicht mehr merken",
  "KI-Zusammenfassung",
  "Vorheriger / nächster Feed",
  "Alle als gelesen markieren",
  "Feed aktualisieren",
  "Split View an / aus",
  "Diese Übersicht",
];

describe("shortcut dialog", () => {
  it("lists every shortcut label", () => {
    const html = renderShortcutDialog();
    LABELS.forEach((label) => expect(html).toContain(label));
  });

  it("is an accessible, initially hidden dialog", () => {
    const html = renderShortcutDialog();
    expect(html).toContain('id="shortcut-dialog"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('id="shortcut-dialog-title"');
    expect(html).toMatch(/id="shortcut-dialog"[^>]*hidden/);
  });

  it("uses V for the split view and no backslash", () => {
    const html = renderShortcutDialog();
    expect(html).toContain("<kbd>V</kbd>");
    expect(html).not.toContain("\\");
  });

  it("groups shortcuts in the documented order", () => {
    expect(SHORTCUT_GROUPS.map((group) => group.title)).toEqual([
      "Navigation",
      "Artikel",
      "Feeds & Ansicht",
    ]);
  });
});

describe("shortcut hints", () => {
  it("formats combinations compactly", () => {
    expect(shortcutHint("markAll")).toBe("⇧A");
    expect(shortcutHint("close")).toBe("Esc");
  });

  it("builds tooltip texts with and without a shortcut", () => {
    expect(tip("Original im Browser öffnen", "original")).toBe(
      "Original im Browser öffnen   O",
    );
    expect(tip("Teilen")).toBe("Teilen");
  });
});
