const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

export function giornoIso(testo, oggi = new Date()) {
  if (!testo) return null;
  const pulito = testo.toLowerCase().replace(/\s+/g, ' ').trim();

  const esplicito = pulito.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (esplicito) return esplicito[0];

  const conMese = pulito.match(/(\d{1,2})\s+([a-zàèéìòù]+)(?:\s+(\d{4}))?/);
  if (conMese) {
    const mese = MESI.findIndex((m) => m.startsWith(conMese[2].slice(0, 3)));
    if (mese >= 0) {
      const anno = conMese[3] ? Number(conMese[3]) : annoPlausibile(mese, oggi);
      return iso(anno, mese + 1, Number(conMese[1]));
    }
  }

  const numerico = pulito.match(/(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?/);
  if (numerico) {
    const anno = numerico[3]
      ? Number(numerico[3].length === 2 ? `20${numerico[3]}` : numerico[3])
      : annoPlausibile(Number(numerico[2]) - 1, oggi);
    return iso(anno, Number(numerico[2]), Number(numerico[1]));
  }
  return null;
}

function annoPlausibile(meseZeroBased, oggi) {
  const anno = oggi.getFullYear();
  const scarto = meseZeroBased - oggi.getMonth();
  if (scarto < -6) return anno + 1;
  if (scarto > 6) return anno - 1;
  return anno;
}

function iso(anno, mese, giorno) {
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

export function percheNonValida(voce) {
  if (!voce) return 'voce assente';
  const mancanti = [];
  if (!voce.catena) mancanti.push('catena');
  if (!voce.fonte) mancanti.push('fonte');
  if (!voce.validoDal) mancanti.push('validoDal');
  if (!voce.validoAl) mancanti.push('validoAl');
  if (!Array.isArray(voce.pagine) || voce.pagine.length === 0) {
    mancanti.push('pagine');
  } else if (!voce.pagine.every((p) => typeof p === 'string' && p.startsWith('http'))) {
    mancanti.push('pagine non assolute');
  }
  return mancanti.length === 0 ? null : `manca ${mancanti.join(', ')}`;
}

export function voceValida(voce) {
  if (!voce) return false;
  if (!voce.catena || !voce.fonte) return false;
  if (!voce.validoDal || !voce.validoAl) return false;
  if (!Array.isArray(voce.pagine) || voce.pagine.length === 0) return false;
  return voce.pagine.every((p) => typeof p === 'string' && p.startsWith('http'));
}

export function separaValidita(testo) {
  if (!testo) return [null, null];
  const pezzi = testo.split(/\bal\b/i);
  if (pezzi.length < 2) return [giornoIso(testo), null];
  return [giornoIso(pezzi[0]), giornoIso(pezzi[1])];
}

export function zonaValida(zona) {
  if (!zona || typeof zona !== 'object') return null;
  const { nome, lat, lon, raggioKm } = zona;
  if (typeof nome !== 'string' || !nome.trim()) return null;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (typeof raggioKm !== 'number' || !(raggioKm > 0)) return null;
  return { nome: nome.trim(), lat, lon, raggioKm };
}

export function bersagli(adattatore) {
  const indirizzoValido = (u) => typeof u === 'string' && u.startsWith('http');

  if (Array.isArray(adattatore?.zone)) {
    return adattatore.zone
      .filter((z) => indirizzoValido(z?.indirizzo) && zonaValida(z))
      .map((z) => ({ indirizzo: z.indirizzo, zona: zonaValida(z) }));
  }
  if (indirizzoValido(adattatore?.indirizzo)) {
    return [{ indirizzo: adattatore.indirizzo, zona: zonaValida(adattatore?.zona) }];
  }
  return [];
}

export function daAprire(adattatori, { ancheLeSpente }) {
  const apribili = adattatori.filter((a) => bersagli(a).length > 0);
  if (ancheLeSpente) return apribili;
  return apribili.filter((a) => a.attiva !== false);
}

export function paginaNumerata(copertina, numero) {
  const punto = copertina.lastIndexOf('.');
  if (punto <= 0) return null;
  const estensione = copertina.slice(punto);
  const senzaEstensione = copertina.slice(0, punto);
  const barra = senzaEstensione.lastIndexOf('/');
  if (barra < 0) return null;
  if (!/^\d+$/.test(senzaEstensione.slice(barra + 1))) return null;
  return `${senzaEstensione.slice(0, barra + 1)}${numero}${estensione}`;
}

export const RISORSE_VOLANTINOPIU = 'https://resources.volantinopiu.it/flyer';

export function copertinaVolantinoPiu(indirizzoVolantino) {
  const numero = indirizzoVolantino.match(/volantino(\d{5,})\.html?$/i)?.[1];
  if (!numero) return null;
  const cartella = numero.slice(0, 5).split('').join('/');
  return `${RISORSE_VOLANTINOPIU}/${cartella}/pagine/1.jpg`;
}
