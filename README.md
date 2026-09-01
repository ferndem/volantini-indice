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

**Il `selettoreValidita` è un insieme di candidati, non un puntamento.** Si
leggono *tutti* i nodi che corrispondono e vince il primo che porta una data.
Su MD `.elementor-heading-title` prende quattordici titoli e la data sta nel
tredicesimo: leggendo solo il primo la voce cadeva senza dire perché. Così il
selettore può restare largo, che è l'unico modo di non ritararlo a ogni
restyling.

`attiva: false` la esclude senza cancellarla. **Tutte nascono così**: i
selettori vanno tarati sul sito vero prima di accenderle.

`selettorePagina: null` significa «non ancora saputo»: la catena esiste
nell'elenco, il sopralluogo la apre, la raccolta vera la salta.

**Senza `indirizzo` non si apre nemmeno nel sopralluogo.** È lo stato di una
catena che il sopralluogo non ha ancora localizzato, e la `nota` dice perché.

`attributoPagina: "sfondo"` legge l'immagine dal **CSS** invece che dall'`src`:
serve dove le pagine del volantino sono `background-image`, come su MD.

### Il formato del negozio

Decò pubblica **quattordici volantini insieme**, e la differenza fra loro è il
**formato del punto vendita**: MaxiStore, Supermercati, Market, Superfreddo,
Gourmet. Sta nel `<title>` della pagina del volantino, e la piattaforma
`volantinopiu` lo scrive nel campo facoltativo **`formato`**.

**L'area invece non è dichiarata da nessuna parte**, ed è la ragione per cui
queste due catene restano senza `zona`: una zona indovinata sparirebbe proprio
a chi serve.

Come per le zone, **il filtro sta sul telefono** e vale la stessa regola: se il
nome del negozio dell'utente non nomina nessuno dei formati dell'indice, li
vede **tutti** — non si nasconde mai per ignoranza. Una voce **senza** `formato`
si vede sempre.

Il campo è **additivo**: un'app che non lo conosce continua a leggere l'indice
come prima.

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

Due volte al giorno (`cron: 17 5,17 * * *`), a ogni **push su `main`**, e a
mano. L'innesco su push c'è perché senza, una correzione ai selettori restava
invisibile fino al cron successivo — e il commit che il job stesso fa **non
rinnesca il workflow**: GitHub non fa mai ripartire una Action su un push
autenticato con `GITHUB_TOKEN`. Il commit
avviene **solo se `indice.json` è cambiato**, per non fare rumore.

**Pages pubblica dalle Action, non dal ramo**, e il job `pubblica` serve
davvero. Qui c'era scritto il contrario, ed era falso: fra il 2026-08-31 alle
11:57 e le 18:45 il ramo `main` ha ricevuto quattro commit e **Pages ha
continuato a servire l'indice vuoto**, perché il job di deploy era stato tolto
credendolo inutile. La prova sta nell'API pubblica delle Action: di
`pages-build-deployment` non esiste **nessuna** esecuzione — quel workflow
esiste solo quando la sorgente è un ramo.

`pubblica` fa `checkout` con `ref: main` e non sul SHA che ha innescato il
giro: l'`indice.json` da pubblicare è quello **appena committato** dal job
prima, che a quel SHA non c'era ancora.

## Il prezzo, detto chiaro

L'indice non fa uscire nulla di nessun utente: è un file identico per tutti.

Ma **lo scarico delle pagine, che avviene sul telefono, espone l'indirizzo IP
dell'utente al server della catena.** È lo stesso atto di aprire il volantino in
un browser, ma la promessa «non esce nulla di tuo» lì non vale, e l'app deve
dirlo.

## La strategia `pdf`

Dal 2026-09-01 un adattatore può dichiarare `"piattaforma": "pdf"`. È il caso
**più comune**: quasi ogni catena italiana pubblica il volantino come PDF, e
`volantinopiu` (Decò, Pro7) è l'eccezione che serve JPG numerati.

| Campo | A cosa serve |
|---|---|
| `piattaforma: "pdf"` | apre la pagina, raccoglie i `<a href>` che finiscono in `.pdf` |
| `pdfEsclusi` | regex dei PDF che **non** sono volantini: informative, regolamenti, codici etici |
| `seguiLink` | regex dei link da aprire per cercare il PDF **una pagina più in là** — serve a Todis (la data sta su `/volantini-<regione>/`, il PDF su `/volantini/<regione>/`) e a heyzine |
| `selettoreValidita` | come per le altre strategie: **un insieme di candidati**, non un puntamento |

Un flip-book **heyzine** si riconosce da solo: seguendo il link si estrae
`cdnm.heyzine.com/files/uploaded/<hash>.pdf`. Heyzine è un lettore `pdf.js`,
non un servitore di immagini — `trappole.md` §41.

Ogni PDF trovato diventa **una voce** con `pagine: [indirizzo]`. L'app
riconosce il PDF dalla firma `%PDF-`, non dall'estensione: Todis appende una
query all'URL.

## La strategia `digitalflyer` — le catene per punto vendita

Alcune catene non hanno **un** volantino: ne hanno uno per negozio. Il selettore
di negozio **non si guida a mano**: si chiama l'API che c'è sotto.

Eurospin gira su **SMT digitalflyer** e dà tutti i **1283 negozi in una
chiamata**, ognuno con `province.code` e `gpsCoordinates`. Da lì:

```
POST {origineApi}/oauth/token                       Basic + client_credentials
GET  {origineApi}/api/{insegnaApi}/stores?size=2000  tutti i negozi
GET  .../stores/{alias}/promotions                   date come timbro 20260824000000
GET  .../stores/{alias}/promotions/{p}/contents-light?typeCode=FLY
GET  {origineApi}/files/{uniqueId}/{nome}            il PDF
```

| Campo | A cosa serve |
|---|---|
| `origineApi`, `insegnaApi` | dove chiamare |
| `credenzialiDaVariabile` | il **nome di una variabile d'ambiente**, non la credenziale. Questo repo è **pubblico** e la credenziale è di Eurospin: sta in un secret. Senza, la catena si salta e lo dice |
| `province` | **le sigle da tenere**: `["BN","TO"]` oggi. Per aprirne altre si aggiunge la sigla, **non si scrive codice** |
| `raggioKm` | il raggio della zona di ogni negozio |

**Un adattatore con `origineApi` è apribile anche senza `indirizzo`** — è la
riga che `daAprire` ha dovuto imparare, altrimenti una catena tutta-API veniva
scartata prima di provarci.

**La `fonte` è l'URL del PDF, non la pagina del negozio.** Lo stesso volantino
regionale è servito a molti negozi: usando il PDF come `fonte`, la cache delle
letture sul telefono lo legge **una volta sola** e l'offerta si mostra una
volta sola — `regole-di-dominio.md` §12.7bis. La `zona` invece resta quella del
singolo negozio, con le sue coordinate.

### Il secret che serve a Eurospin

```
gh secret set EUROSPIN_DIGITALFLYER --repo ferndem/volantini-indice --body '<basic base64>'
export EUROSPIN_DIGITALFLYER='<basic base64>'   # per i giri in locale
```

Il valore è l'intestazione `Basic` che il visore di `eurospin.it` manda a
`digitalflyer.eurospin.it/oauth/token`: si legge dalla scheda Rete del browser
sulla pagina di un volantino per punto vendita. **Non si committa.**

## La strategia `carrefour` — due livelli, con cache

Carrefour è l'unica catena per punto vendita che serve **immagini** invece di
un PDF, e sta su due livelli: la **scheda negozio** elenca i volantini con la
loro validità, e ogni **volantino** ha le sue pagine.

```
GET {origineApi}/on/demandware.store/.../Stores-FindStores?lat=&long=&radius=
        -> negozi con stateCode (la provincia) e coordinate
GET {sitemap}   -> l'indirizzo della scheda di ogni negozio, per id
apri scheda     -> i link ai volantini, con «dal .. al ..» accanto
apri volantino  -> la copertina _mp1_0-1_slider.jpg, poi _2-3_, _4-5_ per HEAD
```

**Le pagine dei volantini si aprono una volta sola**, non una per negozio: la
cache è sull'indirizzo del volantino. Senza, cento negozi che condividono lo
stesso volantino regionale lo aprirebbero cento volte.

**Il tetto sui negozi va applicato dopo l'aggancio con la sitemap**, non prima.
I negozi più vicini al centro di Torino sono tutti **Carrefour Express, che non
pubblicano volantino**: tagliare per prossimità dava zero voci. Oggi il tetto è
tolto e si aprono tutti i negozi che hanno una scheda.

