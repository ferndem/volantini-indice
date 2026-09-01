import assert from 'node:assert/strict';
import { conRitentativi, negoziCarrefour, schedeVolantinoDaSitemap, paginaAffiancataCarrefour, bersagliConad, fileDelContenuto, fileDigitalFlyer, giornoDaTimbro, negoziDelleProvince, validitaDaTesto, pdfDaIndirizzi, pdfHeyzine, bersagli, copertinaVolantinoPiu, daAprire, formatoDaTitolo, giornoIso, primaValidita, numeriVolantinoPiu, paginaNumerata, paginaVolantinoPiu, percheNonValida, separaValidita, testoLeggibile, titoloDaHtml, validitaDaHtml, voceValida, zonaValida } from './nucleo.mjs';

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

// TODIS SCRIVE IL MESE UNA VOLTA SOLA: «Dal 3 al 16 settembre». Senza ereditare
// il mese dalla fine, validoDal resta nullo e la voce viene scartata in
// silenzio -- verificato sul sito il 2026-09-01.
assert.deepEqual(
  separaValidita('Dal 3 al 16 settembre'),
  ['2026-09-03', '2026-09-16'],
  'il mese scritto una volta sola vale per tutte e due le date',
);
assert.equal(
  validitaDaTesto('Volantino Todis Dal 3 al 16 settembre 2026'),
  'Dal 3 al 16 settembre 2026',
  'la regex deve accorgersi anche della forma senza mese sulla prima data',
);
// A cavallo di mese l'inizio sta nel mese PRIMA della fine, non nello stesso:
// «dal 28 al 3 settembre» comincia il 28 agosto.
assert.deepEqual(
  separaValidita('dal 28 al 3 settembre 2026'),
  ['2026-08-28', '2026-09-03'],
  'se il giorno di inizio supera quello di fine, il mese e\' quello prima',
);
assert.deepEqual(
  separaValidita('dal 28 al 3 gennaio 2027'),
  ['2026-12-28', '2027-01-03'],
  'e a cavallo d\'anno torna indietro anche di anno',
);

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

// UN SELETTORE DI VALIDITA' E' UN INSIEME DI CANDIDATI, non un puntamento.
// Su MD «.elementor-heading-title» prende quattordici titoli e la data sta nel
// tredicesimo: leggere solo il primo scarta la voce senza dire perche'.
assert.equal(
  primaValidita(['Lettere dall\'Italia', 'Buona Spesa!', 'dal 25 Agosto al 6 Settembre 2026']),
  'dal 25 Agosto al 6 Settembre 2026',
);
assert.deepEqual(
  separaValidita(primaValidita(['Vivo Meglio', 'dal 25 Agosto al 6 Settembre 2026'])),
  ['2026-08-25', '2026-09-06'],
);
assert.equal(
  primaValidita(['dal 01/09/2026 al 10/09/2026', 'dal 20/09/2026 al 30/09/2026']),
  'dal 01/09/2026 al 10/09/2026',
  'vince il primo che porta una data, non l\'ultimo',
);
assert.equal(primaValidita(['niente', 'nemmeno qui']), null);
assert.equal(primaValidita([]), null);
assert.equal(primaValidita(null), null);
assert.equal(primaValidita([null, 42, 'dal 1/9/2026 al 2/9/2026']), 'dal 1/9/2026 al 2/9/2026');


// UN VOLANTINO IN PDF E' LA NORMA, NON L'ECCEZIONE: di 21 catene censite il
// 2026-09-01 la stragrande maggioranza pubblica un PDF, e volantinopiu e' la
// rara piattaforma che serve JPG numerati. Vedi ripartenza-volantini.md §4.
assert.deepEqual(
  pdfDaIndirizzi(['https://x/volantino.pdf', 'https://x/pagina.jpg', 'https://x/altro.PDF']),
  ['https://x/volantino.pdf', 'https://x/altro.PDF'],
  'si tengono solo i pdf, senza badare alle maiuscole',
);
assert.deepEqual(
  pdfDaIndirizzi(['https://www.todis.it/wp-content/uploads/2026/08/OS_19.pdf?x33874']),
  ['https://www.todis.it/wp-content/uploads/2026/08/OS_19.pdf?x33874'],
  'Todis appende una query al pdf: non deve buttarlo via',
);
assert.deepEqual(
  pdfDaIndirizzi(['https://x/informativa-privacy.pdf', 'https://x/volantino.pdf'], ['privacy', 'codice[_-]etico']),
  ['https://x/volantino.pdf'],
  'le informative non sono volantini e si escludono per nome',
);
assert.deepEqual(pdfDaIndirizzi(['/relativo.pdf']), [], 'un pdf relativo non e\' scaricabile dal telefono');
assert.deepEqual(pdfDaIndirizzi(null), []);
assert.deepEqual(pdfDaIndirizzi(['https://x/a.pdf', 'https://x/a.pdf']), ['https://x/a.pdf'], 'niente doppioni');

// Heyzine non serve immagini: e' un lettore pdf.js, e il volantino vero e' il
// PDF su cdnm. Verificato su Supermercati Piccolo il 2026-09-01.
assert.equal(
  pdfHeyzine('a href=\"https:\\/\\/cdnm.heyzine.com\\/files\\/uploaded\\/5794c6a7487430248b861ced4d741479d85ca043.pdf\"'),
  'https://cdnm.heyzine.com/files/uploaded/5794c6a7487430248b861ced4d741479d85ca043.pdf',
);
assert.equal(pdfHeyzine('<html>senza flipbook</html>'), null);
assert.equal(pdfHeyzine(null), null);


// EUROSPIN: le date arrivano come timbro compatto, non come testo italiano.
assert.equal(giornoDaTimbro('20260824000000'), '2026-08-24');
assert.equal(giornoDaTimbro('20260906000000'), '2026-09-06');
assert.equal(giornoDaTimbro(null), null);
assert.equal(giornoDaTimbro('2026-08-24'), null, 'un ISO non e\' un timbro: non si finge di capirlo');
assert.equal(giornoDaTimbro('20261324000000'), null, 'mese 13 non esiste');

const contenuto = {
  properties: [
    { code: 'PDF', values: [{ uniqueId: '8d3fbec2-3648-466e-842b-e57274e7e19a', name: 'EIT-CAMPANIA.pdf' }] },
    { code: 'PREVIEW', values: [{ uniqueId: 'altro', name: 'EIT-CAMPANIA.jpg' }] },
  ],
};
assert.deepEqual(fileDelContenuto(contenuto, 'PDF'), { uniqueId: '8d3fbec2-3648-466e-842b-e57274e7e19a', nome: 'EIT-CAMPANIA.pdf' });
assert.equal(fileDelContenuto(contenuto, 'MANCANTE'), null);
assert.equal(fileDelContenuto({ properties: [{ code: 'PDF', values: [] }] }, 'PDF'), null, 'una proprieta\' senza valori non e\' un file');
assert.equal(
  fileDigitalFlyer('https://digitalflyer.eurospin.it', fileDelContenuto(contenuto, 'PDF')),
  'https://digitalflyer.eurospin.it/files/8d3fbec2-3648-466e-842b-e57274e7e19a/EIT-CAMPANIA.pdf',
);
assert.equal(fileDigitalFlyer('https://x', null), null);

// I 1283 negozi arrivano in una chiamata sola: si sceglie per PROVINCIA, e un
// negozio senza coordinate non puo\' diventare una zona.
const negozi = [
  { alias: 'benevento', province: { code: 'BN' }, gpsCoordinates: { latitude: 41.112, longitude: 14.75 } },
  { alias: 'beinasco', province: { code: 'TO' }, gpsCoordinates: { latitude: 45.02, longitude: 7.6 } },
  { alias: 'milano', province: { code: 'MI' }, gpsCoordinates: { latitude: 45.46, longitude: 9.19 } },
  { alias: 'senza-gps', province: { code: 'BN' }, gpsCoordinates: null },
];
assert.deepEqual(negoziDelleProvince(negozi, ['BN', 'TO']).map((n) => n.alias), ['benevento', 'beinasco']);
assert.deepEqual(negoziDelleProvince(negozi, ['bn']).map((n) => n.alias), ['benevento'], 'la sigla non e\' sensibile alle maiuscole');
assert.deepEqual(negoziDelleProvince(negozi, []), []);
assert.deepEqual(negoziDelleProvince(null, ['BN']), []);

// Una catena che si raccoglie DALL'API non ha un `indirizzo` da aprire, e il
// filtro delle apribili la buttava via prima ancora di provarci.
const daApi = { catena: 'Eurospin', origineApi: 'https://digitalflyer.eurospin.it', province: ['BN'] };
assert.deepEqual(
  daAprire([daApi], { ancheLeSpente: false }),
  [daApi],
  'un adattatore con origineApi e\' apribile anche senza indirizzo',
);
assert.deepEqual(
  daAprire([{ ...daApi, attiva: false }], { ancheLeSpente: false }),
  [],
  'ma resta spegnibile come tutte le altre',
);
assert.deepEqual(
  daAprire([{ catena: 'Coop', attiva: false }], { ancheLeSpente: true }),
  [],
  'una catena senza indirizzo NE\' origineApi resta fuori: non c\'e\' niente da aprire',
);


// CONAD: la scheda negozio e\' l\'indirizzo da aprire, e un negozio SENZA
// volantini non va aperto -- a Benevento sono 16 su 21.
const negoziConad = [
  { codiceProvincia: 'BN', nomeComune: 'BENEVENTO', indirizzo: 'VIA COLONNETTE SNC', latitudine: 41.12, longitudine: 14.77, volantiniCount: 2, pdvPlainUrl: 'https://www.conad.it/ricerca-negozi/conad-a--006212' },
  { codiceProvincia: 'BN', nomeComune: 'BENEVENTO', indirizzo: 'SENZA VOLANTINI', latitudine: 41.13, longitudine: 14.78, volantiniCount: 0, pdvPlainUrl: 'https://www.conad.it/ricerca-negozi/conad-b--006213' },
  { codiceProvincia: 'TO', nomeComune: 'TORINO', indirizzo: 'VIA TARINO 10', latitudine: 45.07, longitudine: 7.69, volantiniCount: 4, pdvPlainUrl: 'https://www.conad.it/ricerca-negozi/conad-c--004021' },
  { codiceProvincia: 'MI', nomeComune: 'MILANO', indirizzo: 'FUORI PROVINCIA', latitudine: 45.46, longitudine: 9.19, volantiniCount: 3, pdvPlainUrl: 'https://www.conad.it/ricerca-negozi/conad-d--000001' },
  { codiceProvincia: 'TO', nomeComune: 'TORINO', indirizzo: 'SENZA COORDINATE', latitudine: null, longitudine: null, volantiniCount: 2, pdvPlainUrl: 'https://www.conad.it/ricerca-negozi/conad-e--000002' },
];
const scelti = bersagliConad(negoziConad, ['BN', 'TO'], 15);
assert.deepEqual(scelti.map((b) => b.indirizzo), [
  'https://www.conad.it/ricerca-negozi/conad-a--006212',
  'https://www.conad.it/ricerca-negozi/conad-c--004021',
]);
assert.deepEqual(scelti[0].zona, { nome: 'BENEVENTO — VIA COLONNETTE SNC', lat: 41.12, lon: 14.77, raggioKm: 15 });
assert.equal(zonaValida(scelti[0].zona) !== null, true, 'la zona costruita deve passare il vaglio delle zone');

// I centri di ricerca si sovrappongono: lo stesso negozio torna due volte e
// non deve diventare due bersagli.
assert.equal(bersagliConad([negoziConad[0], negoziConad[0]], ['BN'], 15).length, 1);
assert.deepEqual(bersagliConad(null, ['BN'], 15), []);


// CARREFOUR: l\'API dei negozi porta la provincia in `stateCode`. A Benevento
// non ce n\'e\' NESSUNO -- verificato il 2026-09-01 su due strade indipendenti,
// la sitemap e questa API. Una catena assente non e\' un difetto.
const negoziCf = [
  { ID: '2117', city: 'RIVALTA', address1: 'via Giaveno 18', stateCode: 'TO', latitude: 45.03, longitude: 7.52 },
  { ID: '0757', city: 'PINEROLO', address1: 'via Giustetto 43', stateCode: 'TO', latitude: 44.88, longitude: 7.33 },
  { ID: '9999', city: 'ASTI', address1: 'fuori provincia', stateCode: 'AT', latitude: 44.9, longitude: 8.2 },
  { ID: '2117', city: 'RIVALTA', address1: 'doppione', stateCode: 'TO', latitude: 45.03, longitude: 7.52 },
  { ID: '5555', city: 'TORINO', address1: 'senza coordinate', stateCode: 'TO', latitude: null, longitude: null },
];
assert.deepEqual(negoziCarrefour(negoziCf, ['TO']).map((n) => n.codice), ['2117', '0757']);
assert.deepEqual(negoziCarrefour(negoziCf, ['BN']), [], 'a Benevento Carrefour non c\'e\'');
assert.equal(negoziCarrefour(negoziCf, ['TO'])[0].nome, 'RIVALTA — via Giaveno 18');
// IL TETTO SI APPLICA DOPO L'AGGANCIO CON LA SITEMAP, non prima: i primi tre
// negozi torinesi che l'API restituisce NON hanno una scheda volantino, e
// tagliare prima dava zero voci -- successo il 2026-09-01.

// La sitemap raddoppia il percorso: «/volantino/x/2117//volantino/x/2117/...».
// La scheda vera e\' il primo pezzo, e l\'id e\' la chiave.
const sitemap = `<urlset>
  <url><loc>https://www.carrefour.it/volantino/iper-rivalta/2117</loc></url>
  <url><loc>https://www.carrefour.it/volantino/iper-rivalta/2117//volantino/iper-rivalta/2117/sottocosto/56872/56872</loc></url>
  <url><loc>https://www.carrefour.it/volantino/iper-pinerolo/0757</loc></url>
  <url><loc>https://www.carrefour.it/promozioni/</loc></url></urlset>`;
const schede = schedeVolantinoDaSitemap(sitemap);
assert.equal(schede.size, 2, 'due schede, non quattro: il doppione e la pagina estranea non contano');
assert.equal(schede.get('2117'), 'https://www.carrefour.it/volantino/iper-rivalta/2117');
assert.equal(schede.get('0757'), 'https://www.carrefour.it/volantino/iper-pinerolo/0757');
assert.equal(schedeVolantinoDaSitemap(null).size, 0);

// Le pagine Carrefour sono DOPPIE: «_2-3_slider.jpg». La copertina si chiama
// «_mp1_0-1_slider.jpg» e le successive vanno a due a due.
const cop = 'https://gdodig-car.youroperator.it/volantini/iper_19/19_PIEMONTE/desktop/19_PIEMONTE_mp1_0-1_slider.jpg';
assert.equal(
  paginaAffiancataCarrefour(cop, 2),
  'https://gdodig-car.youroperator.it/volantini/iper_19/19_PIEMONTE/desktop/19_PIEMONTE_2-3_slider.jpg',
);
assert.equal(
  paginaAffiancataCarrefour('https://x/19_PIEMONTE_2-3_slider.jpg', 4),
  'https://x/19_PIEMONTE_4-5_slider.jpg',
  'anche partendo da una pagina interna',
);
assert.equal(paginaAffiancataCarrefour('https://x/pagina.jpg', 2), null, 'un nome che non e\' Carrefour non si indovina');
assert.equal(paginaAffiancataCarrefour(cop, 0), null);


// CARREFOUR SCRIVE «dal 20/08 al 3/09»: giorno e mese, SENZA anno. La regex
// pretendeva l\'anno nella forma numerica, quindi non trovava niente e le cento
// schede negozio producevano ZERO voci senza un solo messaggio d\'errore.
// Trovato il 2026-09-01 -- trappole.md §43.
assert.equal(validitaDaTesto('dal 20/08 al 3/09 Prezzi Freschi'), 'dal 20/08 al 3/09');
assert.deepEqual(separaValidita('dal 20/08 al 3/09'), ['2026-08-20', '2026-09-03']);
assert.deepEqual(separaValidita('dal 4/09 al 13/09'), ['2026-09-04', '2026-09-13']);
assert.equal(validitaDaTesto('dal 27/08/2026 al 3/09/2026'), 'dal 27/08/2026 al 3/09/2026', 'con l\'anno funziona come prima');
assert.equal(validitaDaTesto('dal 5 al 12'), null, 'due numeri nudi non sono date');


// UN ERRORE DI RETE PASSEGGERO NON DEVE COSTARE UNA CATENA INTERA. Il
// 2026-09-01 un ERR_NAME_NOT_RESOLVED sull'ottantunesimo negozio ha fatto
// buttare 191 voci Carrefour gia' raccolte, e due fetch andate a vuoto hanno
// azzerato Conad -- trappole.md §44.
{
  let chiamate = 0;
  const esito = await conRitentativi(async () => { chiamate += 1; return chiamate < 3 ? null : 'buona'; });
  assert.equal(esito, 'buona');
  assert.equal(chiamate, 3, 'ritenta finche\' non riesce, dentro il tetto');
}
{
  let chiamate = 0;
  assert.equal(await conRitentativi(async () => { chiamate += 1; return null; }), null);
  assert.equal(chiamate, 3, 'e poi si arrende, senza ciclare all\'infinito');
}
{
  let chiamate = 0;
  const esito = await conRitentativi(async () => { chiamate += 1; throw new Error('rete giu\''); });
  assert.equal(esito, null, 'un\'eccezione vale come tentativo fallito, non esce dal ciclo');
  assert.equal(chiamate, 3);
}
{
  let chiamate = 0;
  assert.equal(await conRitentativi(async () => { chiamate += 1; return 0; }), 0, 'zero e\' un esito valido, non un fallimento');
  assert.equal(chiamate, 1);
}
{
  const attese = [];
  await conRitentativi(async () => null, { quanti: 3, attesa: (n) => { attese.push(n); } });
  assert.deepEqual(attese, [0, 1], 'si aspetta fra un tentativo e l\'altro, non dopo l\'ultimo');
}

console.log('prova.mjs: tutto verde');
