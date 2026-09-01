import { chromium } from 'playwright';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { conRitentativi, validitaDaTesto, negoziCarrefour, schedeVolantinoDaSitemap, paginaAffiancataCarrefour, bersagliConad, fileDelContenuto, fileDigitalFlyer, giornoDaTimbro, negoziDelleProvince, pdfDaIndirizzi, pdfHeyzine, bersagli, copertinaVolantinoPiu, daAprire, formatoDaTitolo, primaValidita, numeriVolantinoPiu, paginaNumerata, paginaVolantinoPiu, percheNonValida, separaValidita, titoloDaHtml, validitaDaHtml, voceValida } from './nucleo.mjs';

const CARTELLA_CATENE = 'catene';
const ATTESA_SELETTORE = 15_000;
const ATTESA_PAGINA = 30_000;
const TETTO_PAGINE = 80;
const TETTO_VOLANTINI = 20;
const TETTO_NEGOZI = 2000;
const TENTATIVI_PAGINA = 3;
const AGENTE = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) granrisparmiofm-indice';

async function adattatori({ ancheLeSpente }) {
  const nomi = (await readdir(CARTELLA_CATENE)).filter((n) => n.endsWith('.json'));
  const letti = await Promise.all(
    nomi.sort().map(async (n) => JSON.parse(await readFile(join(CARTELLA_CATENE, n), 'utf8'))),
  );
  return daAprire(letti, { ancheLeSpente });
}

const BOTTONI_CONSENSO = [
  '#onetrust-accept-btn-handler',
  '#didomi-notice-agree-button',
  'button[id*="accept-all" i]',
  'button[class*="accept-all" i]',
  'button[aria-label*="accetta" i]',
];

const TESTO_CONSENSO = /accetta (tutti|tutto|e chiudi)/i;

async function apri(browser, indirizzo) {
  const pagina = await browser.newPage({ userAgent: AGENTE, viewport: { width: 1280, height: 2200 } });
  await pagina.goto(indirizzo, { waitUntil: 'domcontentloaded', timeout: ATTESA_PAGINA });
  await accettaConsenso(pagina);
  await scorriTutto(pagina);
  return pagina;
}

async function accettaConsenso(pagina) {
  for (const selettore of BOTTONI_CONSENSO) {
    const bottone = await pagina.$(selettore);
    if (!bottone) continue;
    await bottone.click({ timeout: 3_000 }).catch(() => {});
    await pagina.waitForTimeout(1_000);
    return selettore;
  }
  const perTesto = pagina.getByRole('button', { name: TESTO_CONSENSO }).first();
  if (await perTesto.count().catch(() => 0)) {
    await perTesto.click({ timeout: 3_000 }).catch(() => {});
    await pagina.waitForTimeout(1_000);
    return 'testo del bottone';
  }
  return null;
}

async function scarica(indirizzo) {
  const risposta = await fetch(indirizzo, { headers: { 'user-agent': AGENTE } }).catch(() => null);
  return risposta?.ok ? risposta.text() : null;
}

async function esiste(indirizzo) {
  for (let tentativo = 0; tentativo < TENTATIVI_PAGINA; tentativo += 1) {
    const risposta = await fetch(indirizzo, { method: 'HEAD', headers: { 'user-agent': AGENTE } })
      .catch(() => null);
    if (risposta?.ok) return true;
    if (risposta && risposta.status >= 400 && risposta.status < 500) return false;
    await new Promise((r) => setTimeout(r, 500 * (tentativo + 1)));
  }
  console.log(`  ${indirizzo} non risponde: il volantino si ferma qui, e potrebbe essere piu' lungo`);
  return false;
}

async function scorriTutto(pagina) {
  await pagina.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 800) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  }).catch(() => {});
  await pagina.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
}

async function raccogliVolantinoPiu(browser, adattatore, bersaglio) {
  const indice = await apri(browser, bersaglio.indirizzo);
  let candidati;
  try {
    candidati = await indice.evaluate(() => [
      ...[...document.querySelectorAll('a[href]')].map((a) => a.href),
      ...[...document.querySelectorAll('img')].map((i) => i.currentSrc || i.src),
    ]);
  } finally {
    await indice.close();
  }

  const origine = adattatore.origineVolantini ?? new URL(bersaglio.indirizzo).origin;
  const numeri = numeriVolantinoPiu(candidati).slice(0, TETTO_VOLANTINI);
  if (numeri.length === 0) console.log(`  nessun volantino elencato su ${bersaglio.indirizzo}`);

  const voci = [];
  for (const numero of numeri) {
    const fonte = paginaVolantinoPiu(origine, numero);
    const html = await scarica(fonte);
    if (html === null) console.log(`  ${fonte} non risponde`);
    const trovata = validitaDaHtml(html ?? '');
    if (html !== null && !trovata) console.log(`  nessuna data in ${fonte}`);
    const [dal, al] = separaValidita(trovata);
    const formato = formatoDaTitolo(titoloDaHtml(html ?? ''), adattatore.catena);
    voci.push({
      catena: adattatore.catena,
      validoDal: dal,
      validoAl: al,
      fonte,
      pagine: await enumeraDaCopertine([copertinaVolantinoPiu(numero)]),
      zona: bersaglio.zona ?? undefined,
      formato: formato ?? undefined,
    });
  }
  return voci;
}

async function chiedi(indirizzo, gettone) {
  const corpo = await jsonDiRete(indirizzo, { authorization: `Bearer ${gettone}`, accept: 'application/json' });
  if (corpo === null) console.log(`  ${indirizzo} non risponde nemmeno ritentando`);
  return corpo;
}

async function gettoneDigitalFlyer(adattatore, credenziali) {
  const corpo = new FormData();
  corpo.append('grant_type', 'client_credentials');
  const risposta = await fetch(`${adattatore.origineApi}/oauth/token`, {
    method: 'POST',
    headers: { 'user-agent': AGENTE, authorization: `Basic ${credenziali}` },
    body: corpo,
  }).catch(() => null);
  if (!risposta?.ok) return null;
  return (await risposta.json().catch(() => null))?.access_token ?? null;
}

async function raccogliDigitalFlyer(adattatore) {
  const credenziali = process.env[adattatore.credenzialiDaVariabile];
  if (!credenziali) {
    console.log(`  ${adattatore.catena}: manca la variabile ${adattatore.credenzialiDaVariabile}, si salta`);
    return [];
  }
  const gettone = await gettoneDigitalFlyer(adattatore, credenziali);
  if (!gettone) {
    console.log(`  ${adattatore.catena}: l'autenticazione non e' riuscita`);
    return [];
  }
  const base = `${adattatore.origineApi}/api/${adattatore.insegnaApi}`;
  const elenco = await chiedi(`${base}/stores?page=0&size=${TETTO_NEGOZI}`, gettone);
  const negozi = negoziDelleProvince(elenco?.elements, adattatore.province);
  console.log(`  ${adattatore.catena}: ${negozi.length} negozi in ${(adattatore.province ?? []).join(', ')}`);

  const contenutiPerPromozione = new Map();
  const voci = [];
  for (const negozio of negozi) {
    const promozioni = await chiedi(`${base}/stores/${negozio.alias}/promotions`, gettone);
    for (const promozione of promozioni ?? []) {
      if (!contenutiPerPromozione.has(promozione.alias)) {
        const contenuti = await chiedi(
          `${base}/stores/${negozio.alias}/promotions/${promozione.alias}/contents-light?typeCode=FLY`,
          gettone,
        );
        const volantino = (contenuti ?? []).find((c) => c?.type?.code === 'FLY');
        contenutiPerPromozione.set(
          promozione.alias,
          fileDigitalFlyer(adattatore.origineApi, fileDelContenuto(volantino, 'PDF')),
        );
      }
      const pdf = contenutiPerPromozione.get(promozione.alias);
      if (!pdf) continue;
      voci.push({
        catena: adattatore.catena,
        validoDal: giornoDaTimbro(promozione.startDate),
        validoAl: giornoDaTimbro(promozione.endDate),
        fonte: pdf,
        pagine: [pdf],
        zona: {
          nome: `${negozio.city} — ${negozio.address}`,
          lat: negozio.gpsCoordinates.latitude,
          lon: negozio.gpsCoordinates.longitude,
          raggioKm: adattatore.raggioKm ?? 15,
        },
      });
    }
  }
  return voci;
}

const ANTENATI_DA_GUARDARE = 5;
const PASSO_AVANZAMENTO = 20;

const attesaCrescente = (tentativo) => new Promise((r) => setTimeout(r, 800 * (tentativo + 1)));

async function jsonDiRete(indirizzo, intestazioni) {
  return conRitentativi(async () => {
    const risposta = await fetch(indirizzo, { headers: { 'user-agent': AGENTE, ...intestazioni } });
    return risposta.ok ? risposta.json() : null;
  }, { attesa: attesaCrescente });
}

async function negoziConad(adattatore) {
  const trovati = [];
  for (const centro of adattatore.centri ?? []) {
    const corpo = await conRitentativi(async () => {
      const risposta = await fetch(`${adattatore.origineApi}/api/corporate/it-it.retrievePointOfService.json`, {
        method: 'POST',
        headers: {
          'user-agent': AGENTE,
          'content-type': 'application/json',
          referer: `${adattatore.origineApi}/ricerca-negozi`,
        },
        body: JSON.stringify({
          latitudine: String(centro.lat),
          longitudine: String(centro.lon),
          raggioRicerca: String(adattatore.raggioRicercaKm ?? 30),
          insegneId: [], serviziId: [], repartiId: [], apertura: [],
        }),
      });
      return risposta.ok ? risposta.json() : null;
    }, { attesa: attesaCrescente });
    if (corpo === null) {
      console.log(`  ${adattatore.catena}: il centro ${centro.nome} non risponde nemmeno ritentando`);
      continue;
    }
    trovati.push(...(corpo?.data ?? []));
  }
  return bersagliConad(trovati, adattatore.province, adattatore.raggioKm ?? 15);
}

async function bersagliVeri(adattatore) {
  if (adattatore.negoziDa !== 'conad') return bersagli(adattatore);
  const negozi = await negoziConad(adattatore);
  console.log(`  ${adattatore.catena}: ${negozi.length} negozi con volantino in ${(adattatore.province ?? []).join(', ')}`);
  return negozi;
}

async function negoziCarrefourDelleProvince(adattatore) {
  const trovati = [];
  for (const centro of adattatore.centri ?? []) {
    const indirizzo = `${adattatore.origineApi}/on/demandware.store/Sites-carrefour-IT-Site/it_IT/Stores-FindStores`
      + `?lat=${centro.lat}&long=${centro.lon}&radius=${adattatore.raggioRicercaKm ?? 50}`;
    const corpo = await jsonDiRete(indirizzo, { accept: 'application/json' });
    if (corpo === null) {
      console.log(`  ${adattatore.catena}: il centro ${centro.nome} non risponde nemmeno ritentando`);
      continue;
    }
    const elenco = corpo?.stores;
    trovati.push(...(Array.isArray(elenco) ? elenco : Object.values(elenco ?? {})));
  }
  return negoziCarrefour(trovati, adattatore.province);
}

async function volantiniDellaScheda(browser, indirizzo) {
  const pagina = await apri(browser, indirizzo);
  try {
    return await pagina.evaluate(() => [...document.querySelectorAll('a[href]')]
      .filter((a) => /\/volantino\/[^/]+\/\d+\/.+\/\d+$/.test(new URL(a.href, location.href).pathname))
      .map((a) => {
        let testo = '';
        let nodo = a;
        for (let salita = 0; salita < 4 && nodo && !testo; salita += 1) {
          testo = (nodo.textContent ?? '').replace(/\s+/g, ' ').trim();
          nodo = nodo.parentElement;
        }
        return { indirizzo: new URL(a.href, location.href).toString(), testo };
      }));
  } finally {
    await pagina.close();
  }
}

async function pagineDelVolantino(browser, indirizzo) {
  const pagina = await apri(browser, indirizzo);
  let copertina;
  try {
    copertina = await pagina.evaluate(() => [...document.querySelectorAll('img')]
      .map((i) => i.currentSrc || i.src)
      .find((s) => /youroperator.*\/desktop\/.*_slider\.jpg/i.test(s)) ?? null);
  } finally {
    await pagina.close();
  }
  if (!copertina) return [];
  const pagine = [copertina];
  for (let sinistra = 2; sinistra <= TETTO_PAGINE; sinistra += 2) {
    const successiva = paginaAffiancataCarrefour(copertina, sinistra);
    if (!successiva || !(await esiste(successiva))) break;
    pagine.push(successiva);
  }
  return pagine;
}

async function raccogliCarrefour(browser, adattatore) {
  const tutti = await negoziCarrefourDelleProvince(adattatore);
  const schede = schedeVolantinoDaSitemap(await scarica(adattatore.sitemap) ?? '');
  const conScheda = tutti.filter((n) => schede.has(n.codice));
  const negozi = adattatore.tettoNegozi > 0 ? conScheda.slice(0, adattatore.tettoNegozi) : conScheda;
  console.log(`  ${adattatore.catena}: ${tutti.length} negozi in ${(adattatore.province ?? []).join(', ')}, ${conScheda.length} con scheda volantino, ne apro ${negozi.length}`);

  const pagineCache = new Map();
  const voci = [];
  let aperti = 0;
  for (const negozio of negozi) {
    aperti += 1;
    if (aperti % PASSO_AVANZAMENTO === 0) {
      console.log(`  ${adattatore.catena}: ${aperti}/${negozi.length} negozi, ${voci.length} voci finora`);
    }
    try {
      for (const volantino of await volantiniDellaScheda(browser, schede.get(negozio.codice))) {
        const [dal, al] = separaValidita(validitaDaTesto(volantino.testo));
        if (!dal || !al) continue;
        if (!pagineCache.has(volantino.indirizzo)) {
          pagineCache.set(volantino.indirizzo, await pagineDelVolantino(browser, volantino.indirizzo));
        }
        const pagine = pagineCache.get(volantino.indirizzo);
        if (pagine.length === 0) continue;
        voci.push({
          catena: adattatore.catena,
          validoDal: dal,
          validoAl: al,
          fonte: volantino.indirizzo,
          pagine,
          zona: { nome: negozio.nome, lat: negozio.lat, lon: negozio.lon, raggioKm: adattatore.raggioKm ?? 15 },
        });
      }
    } catch (errore) {
      console.log(`  ${adattatore.catena}: salto ${negozio.nome} — ${errore.message.split('\n')[0]}`);
    }
  }
  return voci;
}

async function raccogliPdf(browser, adattatore, bersaglio) {
  const pagina = await apri(browser, bersaglio.indirizzo);
  let collegamenti;
  let validita;
  let vicine;
  try {
    collegamenti = await pagina.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href));
    validita = adattatore.selettoreValidita
      ? await pagina.$$eval(adattatore.selettoreValidita, (nodi) => nodi.map((n) => n.textContent ?? '')).catch(() => [])
      : [];
    vicine = await pagina.evaluate((quanti) => {
      const trovate = {};
      for (const ancora of document.querySelectorAll('a[href]')) {
        if (!/\.pdf(?:[?#]|$)/i.test(ancora.href)) continue;
        const testi = [];
        let nodo = ancora;
        for (let salita = 0; salita < quanti && nodo; salita += 1) {
          nodo = nodo.parentElement;
          if (nodo) testi.push((nodo.textContent ?? '').replace(/\s+/g, ' '));
        }
        trovate[ancora.href] = testi;
      }
      return trovate;
    }, ANTENATI_DA_GUARDARE).catch(() => ({}));
  } finally {
    await pagina.close();
  }

  const pdf = new Set(pdfDaIndirizzi(collegamenti, adattatore.pdfEsclusi));
  if (adattatore.seguiLink) {
    const daSeguire = collegamenti.filter((u) => new RegExp(adattatore.seguiLink, 'i').test(u));
    for (const collegamento of [...new Set(daSeguire)].slice(0, TETTO_VOLANTINI)) {
      const html = await scarica(collegamento);
      if (html === null) {
        console.log(`  ${collegamento} non risponde`);
        continue;
      }
      const dentro = [...html.matchAll(/href=["']([^"']+)["']/gi)]
        .map((m) => { try { return new URL(m[1], collegamento).toString(); } catch { return null; } })
        .filter(Boolean);
      for (const u of pdfDaIndirizzi(dentro, adattatore.pdfEsclusi)) pdf.add(u);
      const daHeyzine = pdfHeyzine(html);
      if (daHeyzine) pdf.add(daHeyzine);
    }
  }

  const [dalPagina, alPagina] = separaValidita(primaValidita(validita));
  if (pdf.size === 0) console.log(`  nessun pdf su ${bersaglio.indirizzo}`);
  return [...pdf].map((indirizzo) => {
    const [dalVicino, alVicino] = separaValidita(primaValidita(vicine[indirizzo]));
    return {
      catena: adattatore.catena,
      validoDal: dalVicino ?? dalPagina ?? adattatore.validoDal ?? null,
      validoAl: alVicino ?? alPagina ?? adattatore.validoAl ?? null,
      fonte: indirizzo,
      pagine: [indirizzo],
      zona: bersaglio.zona ?? undefined,
    };
  });
}

async function raccogliCatena(browser, adattatore, bersaglio) {
  const pagina = await apri(browser, bersaglio.indirizzo);
  try {
    if (adattatore.selettorePagina) {
      await pagina.waitForSelector(adattatore.selettorePagina, { timeout: ATTESA_SELETTORE });
    }

    const attributo = adattatore.attributoPagina ?? 'src';
    const pagine = await pagina.$$eval(
      adattatore.selettorePagina,
      (nodi, attr) => nodi.map((n) => {
        if (attr !== 'sfondo') return n.getAttribute(attr) ?? n.src ?? '';
        const sfondo = getComputedStyle(n).backgroundImage;
        if (!sfondo || sfondo === 'none' || sfondo.includes('gradient')) return '';
        return sfondo.slice(sfondo.indexOf('(') + 1, sfondo.lastIndexOf(')')).replace(/['"]/g, '');
      }).filter(Boolean),
      attributo,
    );

    const candidatiValidita = adattatore.selettoreValidita
      ? await pagina.$$eval(adattatore.selettoreValidita, (nodi) => nodi.map((n) => n.textContent ?? '')).catch(() => [])
      : [];

    const [dal, al] = separaValidita(primaValidita(candidatiValidita));
    const assolute = [...new Set(pagine.map((p) => new URL(p, bersaglio.indirizzo).toString()))];

    return {
      catena: adattatore.catena,
      validoDal: dal ?? adattatore.validoDal ?? null,
      validoAl: al ?? adattatore.validoAl ?? null,
      fonte: bersaglio.indirizzo,
      pagine: adattatore.enumeraPagine ? await enumeraDaCopertine(assolute) : assolute,
      zona: bersaglio.zona ?? undefined,
    };
  } finally {
    await pagina.close();
  }
}

async function enumeraDaCopertine(copertine) {
  const tutte = [];
  for (const copertina of copertine.filter(Boolean)) {
    tutte.push(copertina);
    for (let numero = 2; numero <= TETTO_PAGINE; numero += 1) {
      const successiva = paginaNumerata(copertina, numero);
      if (!successiva || !(await esiste(successiva))) break;
      tutte.push(successiva);
    }
  }
  return [...new Set(tutte)];
}

async function ispeziona(browser, adattatore, bersaglio) {
  const pagina = await apri(browser, bersaglio.indirizzo);
  try {
    const trovato = await pagina.evaluate(() => {
      const assoluto = (u) => { try { return new URL(u, location.href).toString(); } catch { return null; } };

      const immagini = [...document.querySelectorAll('img')]
        .map((i) => ({
          src: assoluto(i.currentSrc || i.src || i.dataset.src || i.getAttribute('data-original') || ''),
          classe: i.className || '',
          largo: i.naturalWidth,
          alto: i.naturalHeight,
        }))
        .filter((i) => i.src && !i.src.startsWith('data:'));

      const grandi = immagini
        .filter((i) => i.largo >= 400 || i.alto >= 400)
        .sort((a, b) => b.largo * b.alto - a.largo * a.alto)
        .slice(0, 25);

      const sfondi = [...document.querySelectorAll('*')]
        .map((n) => getComputedStyle(n).backgroundImage)
        .filter((v) => v && v !== 'none' && !v.includes('gradient'))
        .map((v) => assoluto(v.slice(v.indexOf('(') + 1, v.lastIndexOf(')')).replace(/['"]/g, '')))
        .filter(Boolean);

      const link = [...document.querySelectorAll('a[href]')]
        .filter((a) => /volantin|sfoglia|offert|promo|catalogo/i.test(a.href + ' ' + a.textContent))
        .map((a) => ({ href: assoluto(a.href), testo: (a.textContent || '').trim().slice(0, 60) }))
        .filter((a) => a.href?.startsWith('http'));

      return {
        urlFinale: location.href,
        titolo: document.title.slice(0, 90),
        immaginiTotali: immagini.length,
        immaginiGrandi: grandi,
        sfondiGrandi: [...new Set(sfondi)].slice(0, 10),
        iframe: [...document.querySelectorAll('iframe')].map((f) => f.src).filter(Boolean).slice(0, 10),
        canvas: document.querySelectorAll('canvas').length,
        linkVolantino: [...new Map(link.map((l) => [l.href, l])).values()].slice(0, 25),
        testiConDate: [...document.querySelectorAll('*')]
          .filter((n) => n.children.length === 0 && /\bdal\b[^.]{0,40}\bal\b/i.test(n.textContent ?? ''))
          .map((n) => ({ testo: n.textContent.trim().slice(0, 100), classe: n.className || '' }))
          .slice(0, 8),
      };
    });
    console.log(`\n=== ${adattatore.catena}${bersaglio.zona ? ` [${bersaglio.zona.nome}]` : ''} — ${bersaglio.indirizzo} ===`);
    console.log(JSON.stringify(trovato, null, 2));
  } finally {
    await pagina.close();
  }
}

async function main() {
  const soloIspezione = process.argv.includes('--ispeziona');
  const catene = await adattatori({ ancheLeSpente: soloIspezione });
  if (catene.length === 0) {
    console.log('nessuna catena da aprire: tutte spente, o cartella catene/ vuota');
    return;
  }
  console.log(`${catene.length} catene: ${catene.map((c) => c.catena).join(', ')}`);
  const browser = await chromium.launch();
  const voci = [];

  for (const adattatore of catene) {
    try {
      if (soloIspezione) {
        for (const bersaglio of await bersagliVeri(adattatore)) await ispeziona(browser, adattatore, bersaglio);
        continue;
      }
      const raccolte = [];
      if (adattatore.piattaforma === 'digitalflyer') {
        raccolte.push(...await raccogliDigitalFlyer(adattatore));
      }
      if (adattatore.piattaforma === 'carrefour') {
        raccolte.push(...await raccogliCarrefour(browser, adattatore));
      }
      const senzaBersagli = adattatore.piattaforma === 'digitalflyer' || adattatore.piattaforma === 'carrefour';
      for (const bersaglio of (senzaBersagli ? [] : await bersagliVeri(adattatore))) {
        if (adattatore.piattaforma === 'volantinopiu') {
          raccolte.push(...await raccogliVolantinoPiu(browser, adattatore, bersaglio));
        } else if (adattatore.piattaforma === 'pdf') {
          raccolte.push(...await raccogliPdf(browser, adattatore, bersaglio));
        } else {
          raccolte.push(await raccogliCatena(browser, adattatore, bersaglio));
        }
      }
      const buone = raccolte.filter(voceValida);
      voci.push(...buone);
      for (const v of buone) console.log(`ok   ${v.catena}${v.formato ? ` ${v.formato}` : ''}${v.zona ? ` [${v.zona.nome}]` : ''}: ${v.pagine.length} pagine, ${v.validoDal}→${v.validoAl}`);
      for (const v of raccolte.filter((r) => !voceValida(r))) {
        console.log(`scarto ${adattatore.catena}: ${percheNonValida(v)} — ${v?.fonte ?? '?'}`);
      }
    } catch (errore) {
      console.log(`caduta ${adattatore.catena}: ${errore.message}`);
    }
  }

  await browser.close();
  if (soloIspezione) return;

  const indice = { generatoIl: new Date().toISOString().slice(0, 10), catene: voci };
  await writeFile('indice.json', `${JSON.stringify(indice, null, 2)}\n`);
  console.log(`\nindice.json: ${voci.length} voci da ${catene.length} catene`);
}

if (process.argv[1]?.endsWith('raccogli.mjs')) await main();
