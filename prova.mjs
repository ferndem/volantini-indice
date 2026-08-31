import assert from 'node:assert/strict';
import { daAprire, giornoIso, paginaNumerata, separaValidita, voceValida } from './nucleo.mjs';

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

console.log('prova.mjs: tutto verde');
