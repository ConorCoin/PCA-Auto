# PCA

Automates the Property Condition Assessment (PCA) report. An assessor walks the site taking photos and
dictating observations into their phone; the app turns that into a draft report.

## Delivery: installable PWA (no app store)
The field app in `app/` is a Progressive Web App. Host it over HTTPS (e.g. GitHub Pages), open the URL on the
phone, and use "Add to Home Screen". It then runs full-screen like a native app.

## Layout
- `app/` – phone capture app (photos + voice notes, stored offline in IndexedDB)
- report generation (photos + transcripts -> draft PCA report) – to come
