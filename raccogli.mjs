import { chromium } from 'playwright';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { daAprire, giornoIso, separaValidita, voceValida } from './nucleo.mjs';

const CARTELLA_CATENE = 'catene';
const ATTESA_SELETTORE = 15_000;
const ATTESA_PAGINA = 30_000;

async function adattatori({ ancheLeSpente }) {
  const nomi = (await readdir(CARTELLA_CATENE)).filter((n) => n.endsWith('.json'));
  const letti = await Promise.all(
    nomi.sort().map(async (n) => JSON.parse(await readFile(join(CARTELLA_CATENE, n), 'utf8'))),
  );
  return daAprire(letti, { ancheLeSpente });
}

async function apri(browser, indirizzo) {
  const pagina = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) granrisparmiofm-indice',
  });
  await pagina.goto(indirizzo, { waitUntil: 'domcontentloaded', timeout: ATTESA_PAGINA });
  return pagina;
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
      (nodi, attr) => nodi.map((n) => n.getAttribute(attr) ?? n.src ?? '').filter(Boolean),
      attributo,
    );

    const testoValidita = adattatore.selettoreValidita
      ? await pagina.$eval(adattatore.selettoreValidita, (n) => n.textContent).catch(() => null)
      : null;

    const [dal, al] = separaValidita(testoValidita);

    return {
      catena: adattatore.catena,
      validoDal: dal ?? adattatore.validoDal ?? null,
      validoAl: al ?? adattatore.validoAl ?? null,
      fonte: adattatore.indirizzo,
      pagine: [...new Set(pagine.map((p) => new URL(p, adattatore.indirizzo).toString()))],
    };
  } finally {
    await pagina.close();
  }
}

async function ispeziona(browser, adattatore) {
  const pagina = await apri(browser, adattatore.indirizzo);
  try {
    await pagina.waitForTimeout(3_000);
    const trovato = await pagina.evaluate(() => ({
      immagini: [...document.querySelectorAll('img')]
        .map((i) => ({ src: i.currentSrc || i.src, classe: i.className }))
        .filter((i) => i.src && !i.src.startsWith('data:'))
        .slice(0, 40),
      iframe: [...document.querySelectorAll('iframe')].map((f) => f.src).slice(0, 10),
      testiConDate: [...document.querySelectorAll('*')]
        .filter((n) => n.children.length === 0 && /\bdal\b.*\bal\b/i.test(n.textContent ?? ''))
        .map((n) => ({ testo: n.textContent.trim().slice(0, 120), classe: n.className }))
        .slice(0, 10),
    }));
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
      const voce = await raccogliCatena(browser, adattatore);
      if (voceValida(voce)) {
        voci.push(voce);
        console.log(`ok   ${voce.catena}: ${voce.pagine.length} pagine`);
      } else {
        console.log(`vuota ${adattatore.catena}: voce incompleta, esce dall'indice`);
      }
    } catch (errore) {
      console.log(`caduta ${adattatore.catena}: ${errore.message}`);
    }
  }

  await browser.close();
  if (soloIspezione) return;

  const indice = { generatoIl: new Date().toISOString().slice(0, 10), catene: voci };
  await writeFile('indice.json', `${JSON.stringify(indice, null, 2)}\n`);
  console.log(`\nindice.json: ${voci.length} catene su ${catene.length}`);
}

if (process.argv[1]?.endsWith('raccogli.mjs')) await main();
