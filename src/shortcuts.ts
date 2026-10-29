// Keyboard shortcuts of the desktop reader, defined once: the "?" dialog and the
// button tooltips are rendered from this list (the key handling lives in src/html.ts).

export type ShortcutId =
  | "next"
  | "prev"
  | "page"
  | "pageUp"
  | "open"
  | "close"
  | "original"
  | "toggleRead"
  | "save"
  | "summary"
  | "feedNav"
  | "markAll"
  | "refresh"
  | "split"
  | "help";

type Shortcut = {
  id: ShortcutId;
  label: string;
  // Alternatives, each one a key combination
  keys: string[][];
};

export const SHORTCUT_GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: "Navigation",
    items: [
      { id: "next", label: "Nächster Artikel", keys: [["J"], ["↓"]] },
      { id: "prev", label: "Vorheriger Artikel", keys: [["K"], ["↑"]] },
      {
        id: "page",
        label: "Artikel weiterscrollen, am Ende nächster",
        keys: [["Leertaste"]],
      },
      {
        id: "pageUp",
        label: "Artikel zurückscrollen",
        keys: [["⇧", "Leertaste"]],
      },
      { id: "open", label: "Im Reader öffnen", keys: [["Enter"]] },
      { id: "close", label: "Reader schließen", keys: [["Esc"]] },
    ],
  },
  {
    title: "Artikel",
    items: [
      { id: "original", label: "Original im Browser öffnen", keys: [["O"]] },
      { id: "toggleRead", label: "Gelesen / ungelesen", keys: [["M"]] },
      { id: "save", label: "Merken / nicht mehr merken", keys: [["F"]] },
      { id: "summary", label: "KI-Zusammenfassung", keys: [["S"]] },
    ],
  },
  {
    title: "Feeds & Ansicht",
    items: [
      {
        id: "feedNav",
        label: "Vorheriger / nächster Feed",
        keys: [["←"], ["→"]],
      },
      {
        id: "markAll",
        label: "Alle als gelesen markieren",
        keys: [["⇧", "A"]],
      },
      { id: "refresh", label: "Feed aktualisieren", keys: [["R"]] },
      { id: "split", label: "Split View an / aus", keys: [["V"]] },
      { id: "help", label: "Diese Übersicht", keys: [["?"]] },
    ],
  },
];

const findShortcut = (id: ShortcutId): Shortcut | undefined =>
  SHORTCUT_GROUPS.flatMap((group) => group.items).find(
    (item) => item.id === id,
  );

/** Compact form of the first key combination, e.g. "⇧A" */
export const shortcutHint = (id: ShortcutId): string =>
  (findShortcut(id)?.keys[0] ?? []).join("");

/** Text for a data-tip tooltip: the label, followed by the shortcut if there is one */
export const tip = (label: string, id?: ShortcutId): string =>
  id ? `${label}   ${shortcutHint(id)}` : label;

const renderKeys = (keys: string[][]): string =>
  keys
    .map((combo) =>
      combo
        .map((key) => `<kbd>${key}</kbd>`)
        .join('<span class="shortcut-join">+</span>'),
    )
    .join('<span class="shortcut-join">/</span>');

const renderGroup = (group: { title: string; items: Shortcut[] }): string => `
                <section class="shortcut-group">
                    <h3>${group.title}</h3>
                    ${group.items
                      .map(
                        (item) =>
                          `<div class="shortcut-row"><span>${item.label}</span><span class="shortcut-keys">${renderKeys(item.keys)}</span></div>`,
                      )
                      .join("\n                    ")}
                </section>`;

export const renderShortcutDialog = (): string => {
  const [navigation, ...rest] = SHORTCUT_GROUPS;
  return `<div class="shortcut-dialog" id="shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-dialog-title" hidden>
        <div class="shortcut-sheet">
            <div class="shortcut-sheet-header">
                <h2 id="shortcut-dialog-title">Tastenkürzel</h2>
                <button type="button" class="shortcut-close" id="shortcut-dialog-close" aria-label="Schließen">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            <div class="shortcut-sheet-body">
                <div class="shortcut-column">${renderGroup(navigation)}
                </div>
                <div class="shortcut-column">${rest.map(renderGroup).join("")}
                </div>
            </div>
            <div class="shortcut-sheet-footer">Diese Übersicht öffnest du jederzeit mit <kbd>?</kbd>. Schließen mit <kbd>Esc</kbd>.</div>
        </div>
    </div>`;
};

export const SHORTCUT_DIALOG_CSS = `
        .shortcut-dialog {
            position: fixed;
            inset: 0;
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: rgba(3, 6, 12, 0.6);
            -webkit-backdrop-filter: blur(3px);
            backdrop-filter: blur(3px);
            animation: shortcut-fade 0.15s ease-out;
        }
        .shortcut-dialog[hidden] {
            display: none;
        }
        .shortcut-sheet {
            width: min(720px, 100%);
            max-height: calc(100vh - 48px);
            overflow-y: auto;
            background: #111827;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 14px;
            box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
        }
        .shortcut-sheet-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px 14px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .shortcut-sheet-header h2 {
            font-size: 1rem;
            font-weight: 700;
        }
        .shortcut-close {
            width: 32px;
            height: 32px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: #9ca3af;
            cursor: pointer;
        }
        .shortcut-close:hover,
        .shortcut-close:focus-visible {
            background: rgba(255, 255, 255, 0.07);
            color: #f3f4f6;
        }
        .shortcut-sheet-body {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0 36px;
            padding: 12px 20px 10px;
        }
        .shortcut-group h3 {
            font-size: 0.68rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
            margin: 10px 0 6px;
        }
        .shortcut-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 5px 0;
            font-size: 0.84rem;
            color: #e5e7eb;
        }
        .shortcut-keys {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
        }
        .shortcut-join {
            color: #6b7280;
            font-size: 0.72rem;
        }
        .shortcut-dialog kbd {
            min-width: 22px;
            height: 22px;
            padding: 0 6px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 5px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-bottom-width: 2px;
            background: rgba(255, 255, 255, 0.07);
            font: 600 0.72rem var(--font-family, Inter, system-ui, sans-serif);
            color: #f3f4f6;
        }
        .shortcut-sheet-footer {
            padding: 12px 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(255, 255, 255, 0.02);
            font-size: 0.76rem;
            color: #6b7280;
        }
        @keyframes shortcut-fade {
            from { opacity: 0; }
        }
        @media (max-width: 640px) {
            .shortcut-sheet-body {
                grid-template-columns: 1fr;
            }
        }`;
