# RistoNext — sito ufficiale

Sito aziendale statico per [ristonext.com](https://ristonext.com).

## Stack

- HTML statico + CSS + JavaScript modulare
- [Three.js](https://threejs.org/) via CDN (hero 3D con shader custom)
- Font Google: Inter + Instrument Serif + JetBrains Mono
- Zero build, zero framework, zero dipendenze da installare

## Struttura

```
index.html          Home con hero 3D
ristoratori.html    Pagina per i ristoratori
professionisti.html Pagina per i professionisti
funzioni.html       Tour completo funzioni
chi-siamo.html      Storia, valori, founder
contatti.html       Form contatti + info
assets/
  css/main.css      Tutti gli stili
  js/main.js        Entry point (nav, cursor, reveals)
  js/three-hero.js  Scena 3D della home
  img/              Screenshot dell'app
CNAME               → ristonext.com
```

## Sviluppo locale

Serve un server HTTP (i moduli ES + import map non funzionano da `file://`):

```bash
npx http-server . -p 5177
```

Poi apri http://localhost:5177

## Deploy — GitHub Pages

1. Crea il repo `ristonext-website` (o simile) su GitHub
2. Push del contenuto sul branch `main`
3. Settings → Pages → Source: `main` / `/` (root)
4. Aggiungi `ristonext.com` come Custom domain (il file CNAME è già presente)
5. Su Cloudflare, dove il dominio è ospitato, aggiungi:
   - Record `A` per `ristonext.com` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - Record `CNAME` per `www` → `ricciardi96-netizen.github.io`
6. Attiva "Enforce HTTPS" in GitHub Pages

## Modificare i contenuti

Il sito è statico e tutte le pagine sono file `.html` autonomi con la stessa struttura (nav + main + footer). Per modificare la nav o il footer, aggiornali in tutte e sei le pagine.

I colori, tipografia, spaziatura sono centralizzati in `assets/css/main.css` sotto la sezione `:root` (design tokens).

## Licenza

© 2026 Michele Ricciardi — Tutti i diritti riservati.
