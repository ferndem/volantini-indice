import { chromium } from 'playwright';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { copertinaVolantinoPiu, daAprire, giornoIso, paginaNumerata, separaValidita, voceValida } from './nucleo.mjs';

const CARTELLA_CATENE = 'catene';
const ATTESA_SELETTORE = 15_000;
const ATTESA_PAGINA = 30_000;
const TETTO_PAGINE = 80;
const TETTO_VOLANTINI = 20;

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

async function apri(browser, indirizzo) {
  const pagina = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) granrisparmiofm-indice',
    viewport: { width: 1440, height: 2200 },
  });
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
  return null;
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

async function raccogliVolantinoPiu(browser, adattatore) {
  const indice = await apri(browser, adattatore.indirizzo);
  let indirizzi;
  try {
    indirizzi = await indice.$$eval(
      'a[href*="volantino"]',
      (nodi) => [...new Set(nodi.map((n) => n.href).filter((h) => /volantino\d{5,}\.html?$/i.test(h)))],
    );
  } finally {
    await indice.close();
  }

  const voci = [];
  for (const indirizzo of indirizzi.slice(0, TETTO_VOLANTINI)) {
    const copertina = copertinaVolantinoPiu(indirizzo);
    if (!copertina) continue;
    const singolo = await apri(browser, indirizzo);
    try {
      const testo = await singolo.evaluate(() => document.body.textContent ?? '');
      const [dal, al] = separaValidita(testo.match(/[Dd]al\s+[\d/.]+\s+al\s+[\d/.]+/)?.[0] ?? null);
      const pagine = await enumeraDaCopertine(singolo, [copertina]);
      voci.push({
        catena: adattatore.catena,
        validoDal: dal, validoAl: al,
        fonte: indirizzo,
        pagine,
      });
    } finally {
      await singolo.close();
    }
  }
  return voci;
}

async function raccogliCatena(browser, adattatore) {
  const pagina = await apri(browser, adattatore.indirizzo);
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

    const testoValidita = adattatore.selettoreValidita
      ? await pagina.$eval(adattatore.selettoreValidita, (n) => n.textContent).catch(() => null)
      : null;

    const [dal, al] = separaValidita(testoValidita);
    const assolute = [...new Set(pagine.map((p) => new URL(p, adattatore.indirizzo).toString()))];

    return {
      catena: adattatore.catena,
      validoDal: dal ?? adattatore.validoDal ?? null,
      validoAl: al ?? adattatore.validoAl ?? null,
      fonte: adattatore.indirizzo,
      pagine: adattatore.enumeraPagine ? await enumeraDaCopertine(pagina, assolute) : assolute,
    };
  } finally {
    await pagina.close();
  }
}

async function enumeraDaCopertine(pagina, copertine) {
  const tutte = [];
  for (const copertina of copertine) {
    tutte.push(copertina);
    for (let numero = 2; numero <= TETTO_PAGINE; numero += 1) {
      const successiva = paginaNumerata(copertina, numero);
      if (!successiva) break;
      const risposta = await pagina.request.head(successiva).catch(() => null);
      if (!risposta?.ok()) break;
      tutte.push(successiva);
    }
  }
  return [...new Set(tutte)];
}

async function ispeziona(browser, adattatore) {
  const pagina = await apri(browser, adattatore.indirizzo);
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
    console.log(`\n=== ${adattatore.catena} — ${adattatore.indirizzo} ===`);
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
        await ispeziona(browser, adattatore);
        continue;
      }
      const raccolte = adattatore.piattaforma === 'volantinopiu'
        ? await raccogliVolantinoPiu(browser, adattatore)
        : [await raccogliCatena(browser, adattatore)];
      const buone = raccolte.filter(voceValida);
      voci.push(...buone);
      for (const v of buone) console.log(`ok   ${v.catena}: ${v.pagine.length} pagine, ${v.validoDal}→${v.validoAl}`);
      const scartate = raccolte.length - buone.length;
      if (scartate > 0) console.log(`vuote ${adattatore.catena}: ${scartate} voci incomplete, escono dall'indice`);
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
