import assert from 'node:assert/strict';
import { bersagli, copertinaVolantinoPiu, daAprire, formatoDaTitolo, giornoIso, numeriVolantinoPiu, paginaNumerata, paginaVolantinoPiu, percheNonValida, separaValidita, testoLeggibile, titoloDaHtml, validitaDaHtml, voceValida, zonaValida } from './nucleo.mjs';

const oggi = new Date('2026-08-31T12:00:00Z');

assert.equal(giornoIso('2026-09-03', oggi), '2026-09-03', 'una data ISO passa intera');
assert.equal(giornoIso('dal 27 agosto', oggi), '2026-08-27', 'giorno e mese in lettere');
assert.equal(giornoIso('3 settembre 2026', oggi), '2026-09-03', 'anno esplicito');
assert.equal(giornoIso('27/08/2026', oggi), '2026-08-27', 'numerico esteso');
assert.equal(giornoIso('27/08/26', oggi), '2026-08-27', 'anno a due cifre');
assert.equal(giornoIso('27.08', oggi), '2026-08-27', 'separatore punto, anno dedotto');
assert.equal(giornoIso('', oggi), null, 'vuoto');
assert.equal(giornoIso('nessuna data qui', oggi), null, 'testo senza data');
assert.equal(giornoIso('32/13/2026', oggi), null, 'giorno e mese impossibili');

// L'anno si deduce dal mese piu' vicino, non dall'anno corrente e basta:
// a fine dicembre un volantino "dal 3 gennaio" e' dell'anno DOPO.
assert.equal(giornoIso('3 gennaio', new Date('2026-12-28T12:00:00Z')), '2027-01-03', 'scavalca l\'anno');
assert.equal(giornoIso('28 dicembre', new Date('2027-01-03T12:00:00Z')), '2026-12-28', 'torna indietro di un anno');

assert.deepEqual(separaValidita('dal 27 agosto al 3 settembre 2026'), ['2026-08-27', '2026-09-03']);
assert.deepEqual(separaValidita(null), [null, null]);
assert.deepEqual(separaValidita('offerte valide'), [null, null], 'testo senza date');

const buona = {
  catena: 'MD', validoDal: '2026-08-27', validoAl: '2026-09-03',
  fonte: 'https://esempio/v', pagine: ['https://esempio/1.jpg'],
};
assert.equal(voceValida(buona), true);
assert.equal(voceValida({ ...buona, pagine: [] }), false, 'zero pagine: niente da leggere');
assert.equal(voceValida({ ...buona, validoAl: null }), false, 'senza validita non si mostra');
assert.equal(voceValida({ ...buona, fonte: '' }), false, 'senza fonte la dicitura non e\' verificabile');
assert.equal(voceValida({ ...buona, pagine: ['/relativo.jpg'] }), false, 'pagine relative: non scaricabili dal telefono');
assert.equal(voceValida(null), false);

// Il sopralluogo serve ESATTAMENTE sulle catene non ancora accese: se
// rispettasse `attiva` non aprirebbe mai niente, ed e' il difetto che il
// 2026-08-31 ha fatto girare la Action a vuoto senza stampare una riga.
const spenta = { catena: 'MD', indirizzo: 'https://esempio/md', attiva: false };
const accesa = { catena: 'Lidl', indirizzo: 'https://esempio/lidl', attiva: true };
const senzaFlag = { catena: 'Eurospin', indirizzo: 'https://esempio/eurospin' };

assert.deepEqual(
  daAprire([spenta, accesa, senzaFlag], { ancheLeSpente: true }),
  [spenta, accesa, senzaFlag],
  'il sopralluogo apre anche le catene spente, altrimenti non serve a niente',
);
assert.deepEqual(
  daAprire([spenta, accesa, senzaFlag], { ancheLeSpente: false }),
  [accesa, senzaFlag],
  'la raccolta vera salta le spente; senza flag vale accesa',
);
assert.deepEqual(daAprire([], { ancheLeSpente: true }), [], 'cartella vuota');

// Una catena senza indirizzo e' una che il sopralluogo non ha ancora
// localizzato — Coop bloccata da 403, Sigma e Sisa da ritrovare, Sole 365
// senza volantino. Aprirle significherebbe passare `undefined` a page.goto.
const senzaIndirizzo = { catena: 'Coop', attiva: false };
assert.deepEqual(
  daAprire([senzaIndirizzo, spenta, accesa], { ancheLeSpente: true }),
  [spenta, accesa],
  'una catena senza indirizzo non si apre nemmeno nel sopralluogo',
);
assert.deepEqual(
  daAprire([{ catena: 'X', indirizzo: 'non-un-url', attiva: true }], { ancheLeSpente: true }),
  [],
  'un indirizzo che non e\' un URL vale come assente',
);

// Le piattaforme tipo volantinopiu servono la copertina come .../pagine/1.jpg
// e le altre pagine cambiando solo quel numero. E' l'unico modo di avere il
// volantino INTERO invece della sola copertina, che all'OCR non serve.
const copertina = 'https://resources.volantinopiu.it/flyer/2/8/4/2/2/pagine/1.jpg';
assert.equal(paginaNumerata(copertina, 7), 'https://resources.volantinopiu.it/flyer/2/8/4/2/2/pagine/7.jpg');
assert.equal(paginaNumerata(copertina, 1), copertina, 'la pagina 1 e\' la copertina stessa');

// Le cifre nel PERCORSO non si toccano: solo l'ultimo segmento, che e' il numero
assert.equal(
  paginaNumerata('https://x/flyer/2/8/4/2/2/pagine/12.jpg', 3),
  'https://x/flyer/2/8/4/2/2/pagine/3.jpg',
  'il numero a due cifre si sostituisce intero',
);
assert.equal(paginaNumerata('https://x/cover.jpg', 2), null, 'ultimo segmento non numerico: non si enumera');
assert.equal(paginaNumerata('https://x/pagine/1', 2), null, 'senza estensione: non si enumera');
assert.equal(paginaNumerata('', 2), null);

// Su volantinopiu il numero nell'indirizzo DA' la cartella delle pagine:
// Il numero del volantino arriva da DUE forme: il link alla pagina, e la
// copertina. Deco' pubblica entrambe, Pro7 SOLO la copertina — e per questo
// il 2026-08-31 non produceva una riga.
assert.deepEqual(
  numeriVolantinoPiu(['https://deco.volantinopiu.com/volantino2852200.html']),
  ['2852200'],
);
assert.deepEqual(
  numeriVolantinoPiu(['https://resources.volantinopiu.it/flyer/2/8/4/2/2/pagine/1.jpg']),
  ['2842200'],
  'dalla copertina: le cinque cifre della cartella piu\' il suffisso 00',
);
assert.deepEqual(
  numeriVolantinoPiu([
    'https://deco.volantinopiu.com/volantino2852200.html',
    'https://resources.volantinopiu.it/flyer/2/8/5/2/2/pagine/1.jpg',
  ]),
  ['2852200'],
  'link e copertina dello stesso volantino danno UN numero solo',
);
assert.deepEqual(
  numeriVolantinoPiu(['https://pro7.it/chi-siamo', 'https://x/logo.png', null, 42]),
  [],
  'quello che non e\' un volantino non diventa un numero',
);
assert.deepEqual(
  numeriVolantinoPiu(['https://x/volantino2852200.html?utm=1', 'https://x/volantino2852300.html#p2']),
  ['2852200', '2852300'],
  'query e frammento non impediscono il riconoscimento',
);

// volantino2852200 -> /flyer/2/8/5/2/2/pagine/1.jpg. Sono le PRIME CINQUE
// cifre, non tutte: le ultime due sono un suffisso.
assert.equal(
  copertinaVolantinoPiu('2852200'),
  'https://resources.volantinopiu.it/flyer/2/8/5/2/2/pagine/1.jpg',
);
assert.equal(copertinaVolantinoPiu('12'), null, 'numero troppo corto: non si indovina');
assert.equal(copertinaVolantinoPiu(''), null);
assert.equal(copertinaVolantinoPiu(null), null);

// Pro7 elenca i volantini su pro7.it ma li SERVE su pro7.volantinopiu.com:
// l'origine della pagina del volantino non e' quella dell'indice.
assert.equal(
  paginaVolantinoPiu('https://pro7.volantinopiu.com', '2842200'),
  'https://pro7.volantinopiu.com/volantino2842200.html',
);
assert.equal(
  paginaVolantinoPiu('https://deco.volantinopiu.com/', '2852200'),
  'https://deco.volantinopiu.com/volantino2852200.html',
  'la barra finale non si raddoppia',
);
assert.equal(paginaVolantinoPiu('pro7.volantinopiu.com', '2842200'), null, 'origine senza schema');
assert.equal(paginaVolantinoPiu('https://x', 'abc'), null);

// LA TRAPPOLA DEL 2026-08-31: la data sta in un offcanvas che il browser, a
// viewport 1440, NON monta. L'HTML servito ce l'ha sempre: si legge quello.
const offcanvasVero = `<div class="offcanvas-header">
  <a data-bs-dismiss="offcanvas" aria-label="Close"><img src="close.webp" alt=""></a>
  <span class="fw-semibold pt-1"> Dal 01/09/2026 al 10/09/2026 </span>
</div>`;
assert.equal(validitaDaHtml(offcanvasVero), 'Dal 01/09/2026 al 10/09/2026');
assert.deepEqual(separaValidita(validitaDaHtml(offcanvasVero)), ['2026-09-01', '2026-09-10']);

// Uno <script> che parla di date NON deve diventare la validita' del volantino
assert.equal(
  validitaDaHtml('<script>var t = "dal 01/01/2000 al 02/01/2000";</script><p>Dal 27/08/2026 al 04/09/2026</p>'),
  'Dal 27/08/2026 al 04/09/2026',
  'lo script si toglie PRIMA di cercare, o vince la data sbagliata',
);
assert.equal(
  validitaDaHtml('<style>/* dal 01/01/2000 al 02/01/2000 */</style><p>Dal 27/08/2026 al 04/09/2026</p>'),
  'Dal 27/08/2026 al 04/09/2026',
);

// Pro7 scrive la validita' a parole, Deco' in cifre: la stessa lettura serve entrambe
assert.deepEqual(
  separaValidita(validitaDaHtml('<p>Offerte valide dal 27 agosto al 4 settembre 2026</p>')),
  ['2026-08-27', '2026-09-04'],
);
assert.equal(validitaDaHtml('<p>Nessuna data qui</p>'), null);
assert.equal(validitaDaHtml(''), null);
assert.equal(validitaDaHtml(null), null);

// Il testo si legge attraverso i tag: «Dal» e la data non sono nello stesso nodo
assert.equal(testoLeggibile('<span>Dal</span>&nbsp;<b>01/09/2026</b> al 10/09/2026'), 'Dal 01/09/2026 al 10/09/2026');

// Una catena che pubblica per zona ha un indirizzo PER ZONA: Todis serve
// /volantini-lazio/, -puglia/, -sicilia/... Ogni zona diventa una voce sua.
const perZona = {
  catena: 'Todis', attiva: true,
  zone: [
    { nome: 'Lazio', indirizzo: 'https://todis.it/volantini-lazio/', lat: 41.89, lon: 12.48, raggioKm: 120 },
    { nome: 'Puglia', indirizzo: 'https://todis.it/volantini-puglia/', lat: 41.12, lon: 16.87, raggioKm: 150 },
  ],
};
assert.equal(bersagli(perZona).length, 2, 'una zona, un bersaglio');
assert.equal(bersagli(perZona)[0].zona.nome, 'Lazio');
assert.equal(bersagli(perZona)[1].indirizzo, 'https://todis.it/volantini-puglia/');

// Un adattatore normale resta un bersaglio solo, senza zona: e' nazionale
assert.deepEqual(bersagli(accesa), [{ indirizzo: 'https://esempio/lidl', zona: null }]);

// UNA ZONA ROTTA SI SCARTA, ma non porta giu' le altre della stessa catena
const mista = { catena: 'X', zone: [
  { nome: 'Buona', indirizzo: 'https://x/b', lat: 1, lon: 2, raggioKm: 50 },
  { nome: 'Senza raggio', indirizzo: 'https://x/c', lat: 1, lon: 2 },
  { nome: 'Senza indirizzo', lat: 1, lon: 2, raggioKm: 50 },
]};
assert.deepEqual(bersagli(mista).map((b) => b.zona.nome), ['Buona']);

assert.equal(zonaValida({ nome: 'N', lat: 1, lon: 2, raggioKm: 0 }), null, 'raggio non positivo');
assert.equal(zonaValida({ nome: '  ', lat: 1, lon: 2, raggioKm: 5 }), null, 'nome vuoto');
assert.equal(zonaValida({ nome: 'N', lat: '1', lon: 2, raggioKm: 5 }), null, 'coordinate non numeriche');
assert.equal(zonaValida(null), null);

// Una catena le cui zone sono TUTTE rotte non si apre nemmeno nel sopralluogo
assert.deepEqual(daAprire([{ catena: 'Y', zone: [{ nome: 'Z' }] }], { ancheLeSpente: true }), []);

// UN FALLIMENTO DEVE DIRE PERCHE'. «voce incompleta» ha fatto perdere due giri
// di CI il 2026-08-31: non si sapeva se mancasse la data o le pagine.
assert.equal(percheNonValida(buona), null);
assert.equal(percheNonValida({ ...buona, validoDal: null }), 'manca validoDal');
assert.equal(percheNonValida({ ...buona, validoDal: null, validoAl: null }), 'manca validoDal, validoAl');
assert.equal(percheNonValida({ ...buona, pagine: [] }), 'manca pagine');
assert.equal(percheNonValida({ ...buona, pagine: ['/relativa.jpg'] }), 'manca pagine non assolute');
assert.equal(percheNonValida(null), 'voce assente');

// IL FORMATO DEL NEGOZIO sta nel <title>, ed e' cio' che distingue i 14
// volantini Deco': cinque formati per piu' aree. L'app lo filtra sul telefono.
assert.equal(formatoDaTitolo('Deco MaxiStore - Sottocosto', 'Decò'), 'MaxiStore');
assert.equal(formatoDaTitolo('Deco Supermercati - Sottocosto', 'Decò'), 'Supermercati');
assert.equal(formatoDaTitolo('Deco Superfreddo - Sottocosto', 'Decò'), 'Superfreddo');
assert.equal(
  formatoDaTitolo('Pro7 Supermercati - Il Gusto del Buongiorno', 'Pro7'),
  'Supermercati',
  'vale anche dove il nome della catena porta una cifra',
);
assert.equal(
  formatoDaTitolo('Deco - Sottocosto', 'Decò'),
  null,
  'senza niente oltre al nome della catena non c\'e\' formato: il campo non si scrive',
);
assert.equal(formatoDaTitolo('Decò', 'Decò'), null, 'nemmeno senza trattino');
assert.equal(formatoDaTitolo(null, 'Decò'), null);
assert.equal(formatoDaTitolo('Deco Market - Sottocosto', null), null);

assert.equal(titoloDaHtml('<html><head><title>  Deco  Market -\n Sottocosto </title>'), 'Deco Market - Sottocosto');
assert.equal(titoloDaHtml('<title lang="it">Pro7</title>'), 'Pro7', 'gli attributi del tag non disturbano');
assert.equal(titoloDaHtml('<html><head></head>'), null);
assert.equal(titoloDaHtml('<title>   </title>'), null, 'un titolo di soli spazi non e\' un formato');
assert.equal(titoloDaHtml(null), null);

console.log('prova.mjs: tutto verde');
