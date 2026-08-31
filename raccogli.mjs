import { chromium } from 'playwright';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { bersagli, copertinaVolantinoPiu, daAprire, formatoDaTitolo, primaValidita, numeriVolantinoPiu, paginaNumerata, paginaVolantinoPiu, percheNonValida, separaValidita, titoloDaHtml, validitaDaHtml, voceValida } from './nucleo.mjs';

const CARTELLA_CATENE = 'catene';
const ATTESA_SELETTORE = 15_000;
const ATTESA_PAGINA = 30_000;
const TETTO_PAGINE = 80;
const TETTO_VOLANTINI = 20;
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
        for (const bersaglio of bersagli(adattatore)) await ispeziona(browser, adattatore, bersaglio);
        continue;
      }
      const raccolte = [];
      for (const bersaglio of bersagli(adattatore)) {
        raccolte.push(...(adattatore.piattaforma === 'volantinopiu'
          ? await raccogliVolantinoPiu(browser, adattatore, bersaglio)
          : [await raccogliCatena(browser, adattatore, bersaglio)]));
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
