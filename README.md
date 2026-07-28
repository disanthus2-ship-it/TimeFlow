# TimeFlow

Webbasierte App zur persönlichen Zeitplanung. Läuft komplett im Browser, speichert alle Daten lokal (`localStorage`) und benötigt kein Backend, kein Nutzerkonto und keine externe Datenbank.

## Nutzung

Da die App ES-Module-freies, reines HTML/CSS/JS ist, reicht ein einfacher lokaler Webserver (aus Sicherheitsgründen blockieren manche Browser `fetch`/Modul-Zugriffe unter `file://`):

```bash
python3 -m http.server 8000
```

Danach im Browser `http://localhost:8000` öffnen.

## Funktionen

- **Wochenplan-Editor**: Zeitblöcke (Arbeit, Freizeit, Sport, Schlaf, Haushalt & Pflichten, Sonstiges, oder eigene Kategorien) per Klick-und-Ziehen in einem 7-Tage-Raster anlegen, bearbeiten und löschen.
- **Szenarien**: Beliebig viele "Was-wäre-wenn"-Varianten des Wochenplans anlegen (z. B. "4-Tage-Woche", "mehr Sport"), duplizieren, umbenennen und eine davon als Basis (aktueller Alltag) markieren.
- **Analyse & Simulation**: Zwei Szenarien gegenüberstellen (Stunden pro Kategorie, Veränderung pro Kategorie) und die kumulierte Zeitersparnis/-veränderung einer Kategorie über einen frei wählbaren Zeitraum (4–52 Wochen) simulieren, inklusive Umrechnung in frei definierbare Einheiten (z. B. "Trainingseinheiten à 60 min").
- **Export/Import**: Alle Daten als JSON-Datei sichern oder wiederherstellen.
- **Hell/Dunkel-Modus**: folgt automatisch dem System oder lässt sich manuell umschalten.

## Datenhaltung

Alle Daten (Kategorien, Szenarien, Zeitblöcke) liegen ausschließlich im `localStorage` des Browsers. Es gibt kein Nutzerkonto und keine Server-Synchronisation. Über "Einstellungen → Daten" lässt sich der aktuelle Stand als lokale JSON-Datei exportieren bzw. eine solche Datei wieder importieren.
