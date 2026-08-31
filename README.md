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

### Le zone

Sei catene pubblicano **volantini diversi per area**. Un adattatore può quindi
dichiarare un indirizzo **per zona**:

```json
{
  "catena": "Todis",
  "zone": [
    { "nome": "Lazio",  "indirizzo": "https://todis.it/volantini-lazio/",
      "lat": 41.89, "lon": 12.48, "raggioKm": 120 },
    { "nome": "Puglia", "indirizzo": "https://todis.it/volantini-puglia/",
      "lat": 41.12, "lon": 16.87, "raggioKm": 180 }
  ]
}
```

Ogni zona diventa **una voce sua** nell'indice, e l'app la mostra solo a chi fa
la spesa nel raggio — **filtrando sul telefono**, su questo file che resta
identico per tutti. Una voce **senza** zona è nazionale e si vede ovunque.

**Una zona rotta si scarta senza portare giù le altre** della stessa catena, ed
è la stessa disciplina difensiva del resto.

Un adattatore a indirizzo singolo può portare una `zona` invece di `zone`: serve
dove il sito dà un volantino solo ma **legato a un punto vendita** — su
Carrefour l'elenco che il runner vede dipende da dove sta il runner, quindi la
zona va **fissata**, non lasciata alla geolocalizzazione del runner.

`piattaforma: "volantinopiu"` gestisce le catene servite da *volantinopiu*
(Decò, Pro7). Produce **una voce per volantino**, non una per catena: Decò ne ha
14 attivi insieme, con date diverse, e fonderli in una voce sola direbbe il
falso.

Il numero del volantino si ricava da **due forme**, perché le due catene ne
pubblicano una ciascuna: il link `volantinoNNNNNNN.html` (Decò) e la
**copertina** `…/flyer/2/8/4/2/2/pagine/1.jpg` (Pro7, che i link non li mette).
Dalla cartella della copertina si risale al numero — cinque cifre più `00`.

**La validità si legge dall'HTML servito, non dal DOM**, e ci è costato una
giornata: la data sta in un `offcanvas` Bootstrap che il browser, a viewport
larga, **non monta**. A 1440px di larghezza `document.body.textContent` non la
contiene; a 1280 sì. Un `fetch` la trova sempre, non richiede il browser ed è
molto più veloce — quindi la pagina del volantino **non si apre affatto**: si
scarica. Il browser serve solo per l'indice, dove Pro7 inietta i link via JS.

`origineVolantini` esiste per Pro7: elenca su `pro7.it` ma i volantini li serve
`pro7.volantinopiu.com`. Se manca, l'origine è quella dell'indice.

`enumeraPagine: true` risale dalle **copertine** alle pagine interne. Le
piattaforme tipo `volantinopiu` servono la copertina come `…/pagine/1.jpg` e le
altre cambiando solo quel numero: si sonda `2, 3, …` con una `HEAD` finché una
non risponde, con un tetto di 80. **Serve perché una copertina sola all'OCR non
dice niente**: il volantino va preso intero.

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

Il sopralluogo accetta il banner anche **per testo del bottone**
(`/accetta (tutti|tutto|e chiudi)/i`), non solo per `id` o `aria-label`: su Pro7
il banner non ha nessuno dei due, e senza il consenso la pagina non elenca
niente.

La prima versione guardava solo gli `<img>` già caricati, e su Lidl ed Eurospin
ha riportato **soltanto loghi e icone del footer**: il contenuto arrivava dopo
il consenso e dopo lo scorrimento. Guardare poco e concludere «non c'è niente»
è lo stesso errore di un test che passa a vuoto.

**Il sopralluogo ignora `attiva`, ed è il punto.** Serve esattamente sulle
catene ancora spente: se rispettasse quel flag non aprirebbe mai niente. Il
primo giro del 2026-08-31 è finito a vuoto per questo — la Action è passata
verde senza stampare una riga. Ora `daAprire()` sta nel nucleo e ha la sua
prova.

## Provarlo in locale, che è il punto

```
npm install && npx playwright install chromium
node prova.mjs      # il nucleo, senza rete
node raccogli.mjs   # la raccolta vera: ~70 secondi
```

**Questo è il rimedio a un errore vero.** Il 2026-08-31 si sono spesi tre giri
di CI a indovinare perché Decò scartasse 14 voci su 14, dicendo all'utente
«rilancia» dopo aver verificato la logica su una stringa scritta a mano invece
che sulla pagina vera. Con la raccolta eseguibile in locale la causa — il
viewport — è saltata fuori in due minuti.

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
