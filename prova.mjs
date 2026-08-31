import assert from 'node:assert/strict';
import { giornoIso, separaValidita, voceValida } from './nucleo.mjs';

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

console.log('prova.mjs: tutto verde');
