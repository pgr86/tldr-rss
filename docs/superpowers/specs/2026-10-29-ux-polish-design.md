# UX-Feinschliff für den TLDR Reader

Stand: 29.10.2026

## Worum es geht

Der TLDR Reader läuft als installierte PWA vor allem auf dem Desktop: links eine Liste mit Teaser-Karten, rechts (ab 900 px Breite) ein Reader-Bereich als Iframe (`/reader?url=…&embedded=1`). Der Nutzer findet das Design grundsätzlich gut, es fühlt sich aber „noch nicht fertig" an. Ziel ist, die Details so zu verbessern, dass die App rund wirkt, **ohne das Design radikal zu verändern**.

So wird die App genutzt (Aussage des Nutzers): Er überfliegt links die Teaser und öffnet nur ab und zu die Detailansicht im Reader. Die Liste ist also das Hauptwerkzeug, der Reader ist die Ausnahme.

Konkrete Beschwerden des Nutzers:

1. Die Lade-Skelette fühlen sich „gedoppelt" an.
2. Die Icon-Buttons oben rechts sehen im Desktop-Modus alle sehr ähnlich aus.
3. J/K und die Pfeiltasten funktionieren gut, aber es gibt keine Möglichkeit, einen Artikel per Tastatur nach unten zu scrollen.
4. Er wünscht sich über „?" eine Übersicht aller Tastenkürzel.
5. Im Reader stehen oft eckige Klammern mit „Image" und ähnliche Platzhalter.
6. Allgemein: „Es fühlt sich an vielen Stellen noch nicht richtig rund an."

Als Vorlage dient das Mockup, das der Nutzer gesehen und gutgeheißen hat („sieht richtig gut aus"): `docs/superpowers/specs/2026-10-29-ux-polish-mockup.html` (im Browser öffnen; `?` zeigt den Kürzel-Dialog). Die Option-Auswahl am Ende des Mockups ist erledigt: Variante B. Es ist die verbindliche Referenz für Layout und Optik.

## Ziele

- Die Liste lässt sich besser überfliegen: klare Meta-Zeile, Ungelesen-Markierung, sauberer Titel.
- Die Tastatur bedient alles Wichtige, und „?" zeigt alle Kürzel.
- Jeder Button ist eindeutig erkennbar und erklärt sich per Tooltip samt Kürzel.
- Beim Laden gibt es höchstens eine dezente Anzeige und kein Flackern.
- Der Reader-Text enthält keine Markdown-Reste mehr.

## Nicht-Ziele

- Keine neuen Farben, Schriften oder Kartenformen und kein neues Layout-Raster.
- Keine Änderungen an den RSS-Ausgaben (`/*.rss`).
- Kein anderes Verhalten auf dem Handy außer dem Header-Fix (siehe 2.4). Wischgesten, Pull-to-Refresh, Seitenübergänge und der eigenständige Reader auf dem Handy bleiben, wie sie sind.
- Keine Suche, keine Favoriten, keine Schriftgrößen-Einstellung.

## Anti-Ziele (das wäre ein Fehlschlag, selbst wenn es technisch läuft)

- Die App sieht danach wie eine andere App aus.
- J/K fühlt sich langsamer oder träger an als heute.
- Das Überfliegen führt dazu, dass Artikel als gelesen gelten, die der Nutzer nie geöffnet hat.
- Ein Tastenkürzel greift, während der Nutzer in ein Eingabefeld tippt.

## Rahmenbedingungen

- Das HTML wird serverseitig als Template-String erzeugt: `src/html.ts` (Liste) und `src/reader.ts` (Reader), das PWA-Gerüst liegt in `src/pwa.ts`. Inline-CSS und Inline-JS ohne Framework sollen so bleiben.
- Die Authentifizierung läuft über Basic Auth oder `?password=` in der URL. Alle neuen Requests und Links müssen den `password`-Parameter weiterreichen, wie es der bestehende Code bereits tut (`prepareLinks`, `getReaderUrl`, `postReadStatus`).
- Der Service Worker (`public/sw.js`) speichert Reader-Seiten nach dem Prinzip „Cache zuerst" (Schlüssel: die volle URL). Darauf kann Vorladen aufbauen.
- Der Lesestatus liegt im `localStorage` (`tldr-read-status`) und wird zusätzlich an den Server gemeldet.
- Iframe und Elternseite haben denselben Ursprung. Die Elternseite darf also direkt auf `frame.contentWindow` und `frame.contentDocument` zugreifen.
- Die bestehenden Jest-Tests müssen grün bleiben. Neue Logik, die sich testen lässt (Markdown-Umwandlung, Titelbereinigung), bekommt Tests.

## Entscheidungen des Nutzers

- **Variante B für J/K: „Erst überfliegen, dann öffnen".**
  - J/K und ↓/↑ bewegen nur die Auswahl in der Liste.
  - Der ausgewählte Teaser klappt komplett auf.
  - Der Reader rechts öffnet erst mit Enter, Leertaste oder Klick.
  - Als gelesen gilt nur, was wirklich geöffnet oder per M markiert wird.
  - Rechts bleibt der zuletzt geöffnete Artikel stehen, während die Auswahl links weiterwandert.
- Der „?"-Dialog mit allen Tastenkürzeln wird umgesetzt, gruppiert wie im Mockup.
- Das Design bleibt. Umgesetzt wird der Feinschliff aus dem Mockup.

## Was gebaut wird

### 1. Liste (Desktop und Handy, sofern nicht anders vermerkt)

1.1 **Meta-Zeile über dem Titel:** `Quelle · Datum · Lesezeit`.
- Die Quelle ist der Hostname des Artikel-Links ohne `www.`.
- Das Datum bleibt das bisherige relative Format (Heute, Gestern, vor X Tagen, sonst Datum).
- Die Lesezeit kommt aus dem Titel (siehe 1.2), zum Beispiel „17 Min.". Fehlt sie, entfällt das Element samt Trennpunkt.

1.2 **Titel bereinigen:**
- Ein Suffix wie „(17 minute read)" am Titelende wird im HTML entfernt und als Lesezeit genutzt.
- Andere Klammer-Suffixe von TLDR (etwa „(GitHub Repo)") bleiben im Titel stehen.
- Die RSS-Ausgabe ändert sich nicht.

1.3 **Ungelesen-Markierung:** Ungelesene Artikel bekommen einen kleinen blauen Punkt in der Meta-Zeile. Bei gelesenen Artikeln wird der Titel grau (wie im Mockup) und nicht mehr die ganze Karte abgedunkelt.

1.4 **Auswahl:**
- Die ausgewählte Karte hat einen Akzent-Balken links, einen leicht blauen Hintergrund und zeigt den vollständigen Teaser.
- Alle anderen Karten kürzen den Teaser auf 3 Zeilen.
- Auf dem Desktop entfällt der „mehr"-Link, auf dem Handy bleibt er.

1.5 **Listen-Leiste (nur Desktop):** Eine schmale Leiste über der Liste zeigt links „X ungelesen · Stand HH:MM", rechts den Textbutton „✓✓ Alle gelesen".
- Die Ungelesen-Zahl aktualisiert sich live beim Markieren.
- Auf dem Desktop entfallen dafür der Button im Header und der Footer „Stand: …". Auf dem Handy bleiben beide.

1.6 **Ende der Liste:** Wenn alles gelesen ist, steht unter der letzten Karte ein dezenter Hinweis „Alles gelesen". Das ist meine Ergänzung (siehe „Meine Entscheidungen").

### 2. Header und Buttons

2.1 **Buttons ohne Rahmen:** Die Buttons oben rechts haben keinen Rahmen und keinen Hintergrund mehr. Erst beim Hover erscheint eine Hinterlegung. Einen aktiven Zustand (Split View an, Benachrichtigungen an) zeigt die Akzentfarbe. Reihenfolge: Glocke, Split-View-Schalter, Trenner, Tastatur-Symbol (öffnet die Kürzel-Übersicht).

2.2 **Tooltips mit Kürzel:** Alle Icon- und Textbuttons in Header und Leisten bekommen einen eigenen Tooltip mit Namen und Kürzel, etwa „Original im Browser öffnen   O". Der Tooltip erscheint sofort beim Hover, nicht erst mit der Verzögerung des nativen `title`. Für Screenreader bleibt `aria-label` gesetzt.

2.3 **Leerer Reader:** Das „X" im leeren Zustand entfällt. Die Kürzel-Hinweise dort werden auf das neue Modell angepasst (J/K Auswählen, Enter Öffnen, ? Alle Tastenkürzel).

2.4 **Handy-Header:** Die Buttons stehen nicht mehr in einer eigenen Zeile, sondern in der Zeile mit dem Titel. Die Tabs stehen darunter.

### 3. Reader-Leiste (eingebettet im Desktop-Split-View)

3.1 **Links:** Favicon (oder ein Buchstaben-Badge als Ersatz) und Domain, genau einmal. Die zusätzliche Domain-Pille über dem Artikeltitel entfällt im eingebetteten Modus.

3.2 **Rechts in dieser Reihenfolge:**
- Textbutton „✦ Zusammenfassen" (Kürzel S). Er übernimmt die Funktion des bisherigen Buttons in der Meta-Zeile; der Ladezustand wird am Button selbst angezeigt.
- Icon „Teilen", nur wo `navigator.share` existiert.
- Trenner.
- Textbutton „Original ↗" als einziger hervorgehobener Button (Kürzel O).
- „X" zum Schließen (Esc).

3.3 **Entfällt:** Der Button „In neuem Tab öffnen", weil er praktisch dasselbe tut wie „Original".

3.4 **Eigenständige Reader-Seite:** Auf dem Handy und in einem eigenen Tab bleibt die Seite wie heute.

### 4. Tastatur (nur Desktop, ab 900 px)

Variante B:

| Taste | Wirkung |
|---|---|
| J / ↓ | Auswahl eine Karte nach unten (scrollt die Liste mit) |
| K / ↑ | Auswahl eine Karte nach oben |
| Enter | Ausgewählten Artikel im Reader öffnen |
| Leertaste | Ist der ausgewählte Artikel nicht offen, öffnet sie ihn. Ist er offen, scrollt sie den Reader eine Seite nach unten. Ist der Reader schon am Ende, wählt sie den nächsten Artikel aus und öffnet ihn. |
| Shift+Leertaste | Reader eine Seite nach oben scrollen |
| Esc | Reader schließen, sonst den Kürzel-Dialog schließen |
| O | Ausgewählten Artikel im Original öffnen (neuer Tab) |
| M | Ausgewählten Artikel als gelesen oder ungelesen markieren |
| S | Zusammenfassung im offenen Artikel anfordern oder ein- und ausblenden |
| ← / → | Vorheriger oder nächster Feed-Tab |
| Shift+A | Alle im aktuellen Feed als gelesen markieren |
| R | Feed aktualisieren (wie Pull-to-Refresh) |
| V | Split View ein- oder ausblenden |
| ? | Kürzel-Dialog öffnen oder schließen |

Weitere Regeln:
- Seitenweises Scrollen scrollt um die sichtbare Höhe abzüglich etwa zwei Zeilen Überlappung und abzüglich der Reader-Leiste, sanft animiert (etwa 250–300 ms).
- J/K laufen nicht mehr im Kreis: Am Listenende bleibt die Auswahl stehen. Heute springt sie an den Anfang.
- Kürzel greifen nicht, wenn der Fokus in einem Eingabefeld liegt oder Cmd, Ctrl oder Alt gedrückt sind.
- Hat der Iframe den Fokus, leitet er diese Tasten an die Elternseite weiter: J, K, Leertaste, Shift+Leertaste, Enter, O, M, S, R, V, Shift+A, ? und Esc. Heute leitet er j/k/o/m/Esc weiter. Die Leertaste wird dabei abgefangen, damit das Scrollen überall gleich funktioniert.
- Die Pfeiltasten leitet der Iframe **nicht** weiter. Wer in den Artikel geklickt hat, scrollt mit ↑/↓ wie gewohnt den Text, und ←/→ wechseln nicht versehentlich den Feed.
- Ein Klick auf eine Karte wählt sie aus und öffnet sie (wie heute).

### 5. Kürzel-Dialog („?")

- Ein modaler Dialog über der abgedunkelten App mit zwei Spalten: Navigation, Artikel, Feeds & Ansicht. Inhalt wie in der Tabelle oben, Optik wie im Mockup (Tasten als Keycaps).
- Er öffnet sich mit `?` oder über das Tastatur-Symbol im Header.
- Er schließt sich mit Esc, einem Klick daneben oder dem X.
- Beim Öffnen bekommt der Dialog den Fokus. Andere Kürzel sind gesperrt, solange er offen ist.

### 6. Laden ohne Flackern

6.1 **Eine Ladeanzeige:**
- Es gibt nur noch ein Skelett. Spinner und der Text „Artikel wird geladen…" entfallen.
- Das Skelett erscheint erst, wenn der Artikel nach etwa 200 ms noch nicht da ist.
- Bis dahin bleibt der vorige Artikel sichtbar, gern leicht abgedunkelt.

6.2 **Kein zweites Einblenden:** Ist der Artikel geladen, erscheint er mit einer einzigen kurzen Einblendung. Insbesondere darf im Iframe keine zusätzliche dokumentübergreifende View Transition laufen (die PWA-Übergänge aus `src/pwa.ts` gelten im eingebetteten Modus nicht). Auch die Ein-Animation der Karten darf dabei nicht erneut starten.

6.3 **Vorladen, aber sparsam:**
- Vorgeladen wird nur der **nächste** Artikel, und nur solange ein Artikel im Reader offen ist, also für den Lesefluss mit der Leertaste. Die bloße Auswahl beim Überfliegen lädt nichts vor.
- Hintergrund: Jede Reader-Seite durchläuft serverseitig die teure Extraktionskette aus direktem Abruf, Jina und Archiv. Jina läuft ohne API-Key und hat Limits. Würde jede kurz angehaltene Auswahl vorladen, wäre das fast der ganze Feed, obwohl der Nutzer selten etwas öffnet.
- Es ist höchstens ein Vorlade-Request gleichzeitig offen. Schon im Cache liegende Seiten werden nicht erneut geladen.
- Ohne Service Worker darf das Vorladen wirkungslos sein, aber keine doppelten Server-Requests beim Öffnen erzeugen.

6.3a **Service Worker härten (`public/sw.js`):**
- Fallback-Seiten des Readers werden nicht dauerhaft gecacht. Gemeint ist etwa der Hinweis „Paywall/Bot-Schutz" oder eine nach Timeout erzeugte Ersatzseite. Der Server markiert sie dafür erkennbar, zum Beispiel per Response-Header.
- Damit friert ein einzelner fehlgeschlagener Abruf nicht für immer ein.

6.4 **Auswahl wechseln:** Wechselt man schnell die Auswahl, wird nichts neu aufgebaut, was nicht nötig ist. Das Skelett wird nicht bei jedem Tastendruck neu gerendert.

### 7. Reader-Text (Jina-Fallback in `parseJinaMarkdownToHtml`)

7.1 **Bilder:**
- `![alt](src)` wird zu `<figure><img src alt loading="lazy">…</figure>`.
- Eine Bildunterschrift gibt es nur, wenn der Alt-Text aussagekräftig ist. Präfixe wie „Image 3:" werden entfernt; ein Alt-Text, der nur aus „Image N" besteht, gilt als leer.
- Verlinkte Bilder `[![alt](src)](href)` werden zu einem Bild, das auf `href` verlinkt.

7.2 **Weitere Markdown-Elemente:** Aufzählungen (`-`, `*`, `+`) und nummerierte Listen werden zu `<ul>`/`<ol>`. Dazu kommen Inline-Code, Codeblöcke und Trennlinien. Fett und kursiv dürfen Listenpunkte nicht mehr zerstören.

7.3 **Escaping:** Text aus dem Markdown wird HTML-escaped, bevor die Markdown-Auszeichnung angewendet wird. Heute landet fremdes HTML ungefiltert im Reader. Links und Bilder akzeptieren nur `http(s)`-URLs.

7.4 **Prüfen:** Falls beim Testen mit echten Artikeln auch im Readability-Pfad sichtbare Platzhalter in eckigen Klammern auftauchen, werden sie ebenfalls entfernt.

7.5 **Tests:** Jeder Fall bekommt einen Test in `src/test/reader.test.ts`.

### 8. Ungelesen-Zahlen in den Tabs (optional, zuletzt)

Neben jedem Tab steht die Zahl ungelesener Artikel, wie im Mockup.
- Gebaut wird das nur, wenn es ohne zusätzliche Abrufe bei TLDR geht. Die Seite bekommt dann die Artikel-Links der anderen Feeds aus dem Server-Cache mit, und der Client verrechnet sie mit dem lokalen Lesestatus.
- Feeds ohne Cache-Eintrag zeigen keine Zahl.
- Würde die Seite dadurch spürbar größer (Richtwert über 40 KB zusätzlich) oder langsamer, lässt der Builder das weg und notiert es.

## Meine Entscheidungen (nicht vom Nutzer bestätigt)

- Die Belegung der Kürzel orientiert sich an Feedbin, NetNewsWire und Miniflux. Die Leertaste scrollt und springt am Ende weiter, ←/→ wechseln den Feed, Shift+A markiert alles als gelesen.
- Die Split View schaltet **V** statt „\", weil „\" auf der deutschen Tastatur nur mit Alt bzw. AltGr erreichbar ist und damit unter die Regel „keine Kürzel mit Alt/Ctrl" fiele. Das „?" (Shift+ß) ist unproblematisch.
- Die Pfeiltasten werden aus dem Iframe nicht weitergeleitet.
- Vorgeladen wird nur der nächste Artikel bei offenem Reader. Dazu werden Fallback-Seiten im Service Worker nicht mehr dauerhaft gecacht.
- J/K laufen nicht mehr im Kreis.
- „In neuem Tab öffnen" entfällt.
- Der Hinweis „Alles gelesen" am Listenende ist neu.
- Die Ungelesen-Zahlen in den Tabs sind optional und kommen zuletzt (Punkt 8).
- Wo es kein Favicon gibt, steht ein Buchstaben-Badge.

## Was der Builder entscheidet

- Die genaue technische Umsetzung von Tooltips, Dialog, Vorladen (etwa `fetch` über den Service Worker oder `<link rel="prefetch">`) und Scroll-Animation.
- Genaue Abstände, Animationszeiten und Schatten, solange es wie im Mockup aussieht.
- Ob die Kürzel-Daten einmal zentral definiert werden und daraus Dialog und Tooltips entstehen. Das wird empfohlen.
- Die Reihenfolge der Umsetzung.
