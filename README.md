# volantini-indice

Pubblica **`indice.json`**: un elenco di **indirizzi** delle pagine dei
volantini di alcune catene di supermercati italiane. Lo legge l'app
GranRisparmioFM, che scarica quelle pagine e le legge **sul telefono**.

```
https://ferndem.github.io/volantini-indice/indice.json
```

## Cosa NON c'è qui dentro, ed è il punto

**Non c'è nessun contenuto di nessun volantino.** Niente prezzi, niente
descrizioni, niente immagini copiate. Solo **link** alle pagine che le catene
pubblicano già sui propri siti.

È una scelta deliberata, non una semplificazione. Il diritto *sui generis* sul
database (dir. 96/9/CE, artt. 102-bis e 102-ter l.d.a.) è indipendente dal
copyright e protegge l'investimento nella raccolta: estrarre e ripubblicare in
modo sistematico il contenuto dei volantini di più catene sarebbe estrazione e
reimpiego di parte sostanziale. **Un indice di link non lo è.**

Il dispositivo che scarica un volantino pubblico e lo legge è l'utente che legge
il volantino: lo stesso atto di un browser.

## Perché serve una CI e non basta il telefono

Tre catene su cinque rendono la pagina del volantino in JavaScript. Un
`URLSession` o un `HttpURLConnection` vedono un guscio vuoto. Serve un browser
vero — qui, una volta sola per tutti, invece che su ogni telefono.

## Il formato

Congelato: è fissato dai vettori dell'app (`FlyerOffers/vectors/indice-puntatori.json`)
e implementato su iOS e Android.

```json
{
  "generatoIl": "2026-08-31",
  "catene": [
    {
      "catena": "MD",
      "validoDal": "2026-08-27",
      "validoAl": "2026-09-03",
      "fonte": "https://…/volantini",
      "pagine": ["https://…/1.jpg", "https://…/2.jpg"]
    }
  ]
}
```

**L'app legge questo file in modo difensivo**, e la proprietà è ciò che rende
sostenibile la manutenzione: una voce corrotta non uccide le altre, una data non
ISO scarta la voce, zero pagine scarta la voce, un campo sconosciuto in più non
rompe niente, un JSON troncato vale «non disponibile» e **mai** un errore
mostrato.

**Quindi questa CI può pubblicare un indice parziale, o vuoto, senza rompere
niente.** Se una catena cade, esce dall'indice fino al giro dopo.

## I file

| File | Cosa fa |
|---|---|
| `nucleo.mjs` | le funzioni pure: normalizzare una data, separare «dal … al …», decidere se una voce è pubblicabile e quali catene aprire. **Nessun browser, nessuna rete** |
| `prova.mjs` | la prova del nucleo. `node prova.mjs`, senza installare niente |
| `raccogli.mjs` | apre i siti con Playwright, applica gli adattatori, scrive `indice.json` |
| `catene/*.json` | un adattatore per catena, **dichiarativo** |
| `indice.json` | l'uscita, committata su `main` e servita da Pages |

Il nucleo è separato dal browser per la stessa ragione per cui lo è nell'app:
la parte che decide qualcosa dev'essere provabile senza accendere niente.

## L'adattatore di una catena

```json
{
  "catena": "MD",
  "indirizzo": "https://…/volantini",
  "selettorePagina": "img.pagina-volantino",
  "attributoPagina": "src",
  "selettoreValidita": ".date-validita",
  "attiva": true
}
```

`attiva: false` la esclude senza cancellarla. **Tutte nascono così**: i
selettori vanno tarati sul sito vero prima di accenderle.

`selettorePagina: null` significa «non ancora saputo»: la catena esiste
nell'elenco, il sopralluogo la apre, la raccolta vera la salta.

**Senza `indirizzo` non si apre nemmeno nel sopralluogo.** È lo stato di una
catena che il sopralluogo non ha ancora localizzato, e la `nota` dice perché.

`attributoPagina: "sfondo"` legge l'immagine dal **CSS** invece che dall'`src`:
serve dove le pagine del volantino sono `background-image`, come su MD.

**Sono 21 adattatori per 27 insegne**, perché alcune condividono il sito: Conad
con Conad City e Spazio Conad, Carrefour Market con Express, Coop con Ipercoop,
Despar con Eurospar e Interspar.

Quando una catena rifà il sito, si cambia una riga qui — non una funzione.

## Il sopralluogo

I selettori non si indovinano. Si esegue la Action a mano con
**`ispeziona = true`**: apre ogni catena e stampa cosa trova, **senza scrivere
`indice.json`**. Da lì si scrivono i selettori, si mette `attiva: true`, e si
esegue normalmente.

Il sopralluogo **accetta il banner dei cookie** (OneTrust, Didomi e simili),
**scorre tutta la pagina** per far caricare le immagini pigre, aspetta la rete
ferma, e poi riporta:

| Campo | A cosa serve |
|---|---|
| `urlFinale`, `titolo` | dove si è arrivati davvero, dopo i redirect |
| `immaginiGrandi` | solo quelle da ≥400px per lato, ordinate per area, **con le loro dimensioni e classi**: una pagina di volantino è grande, un logo no |
| `sfondiGrandi` | immagini messe via CSS, che nessun `<img>` mostrerebbe |
| `linkVolantino` | i link che parlano di volantini: **è così che si trova la pagina vera partendo dalla home** |
| `iframe`, `canvas` | i visori di terze parti, che sono il caso difficile |
| `testiConDate` | i «dal … al …» da cui si ricava la validità |

La prima versione guardava solo gli `<img>` già caricati, e su Lidl ed Eurospin
ha riportato **soltanto loghi e icone del footer**: il contenuto arrivava dopo
il consenso e dopo lo scorrimento. Guardare poco e concludere «non c'è niente»
è lo stesso errore di un test che passa a vuoto.

**Il sopralluogo ignora `attiva`, ed è il punto.** Serve esattamente sulle
catene ancora spente: se rispettasse quel flag non aprirebbe mai niente. Il
primo giro del 2026-08-31 è finito a vuoto per questo — la Action è passata
verde senza stampare una riga. Ora `daAprire()` sta nel nucleo e ha la sua
prova.

## Ritmo, e come arriva su Pages

Due volte al giorno (`cron: 17 5,17 * * *`) più l'avvio a mano. Il commit
avviene **solo se `indice.json` è cambiato**, per non fare rumore.

**Pages pubblica dal ramo `main`**, non dalle Action: il commit dell'indice fa
ripartire Pages da solo. Per questo il workflow non ha un job di deploy — ne
aveva uno, ed era sia inutile sia rotto, perché `deploy-pages` pretende che la
sorgente sia impostata su «GitHub Actions».

## Il prezzo, detto chiaro

L'indice non fa uscire nulla di nessun utente: è un file identico per tutti.

Ma **lo scarico delle pagine, che avviene sul telefono, espone l'indirizzo IP
dell'utente al server della catena.** È lo stesso atto di aprire il volantino in
un browser, ma la promessa «non esce nulla di tuo» lì non vale, e l'app deve
dirlo.
