import {chromium} from '@playwright/test';
import {createApp} from '../server/app.js';
import assert from 'node:assert/strict';
const {app,close}=createApp({password:'density-test-only-password',secret:'density-test-secret-at-least-32-characters',dbPath:':memory:'});
const {default:express}=await import('express');const host=express();host.use('/futter',app);const server=host.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({headless:true,...(process.env.FUTTER_CHROMIUM ? {executablePath:process.env.FUTTER_CHROMIUM} : {})});
try {
 const page=await browser.newPage();
 await page.goto(`http://127.0.0.1:${server.address().port}/futter/`);
 await page.getByLabel('Haushaltspasswort').fill('density-test-only-password');
 await page.getByRole('button',{name:'Anmelden',exact:false}).click();
 await page.getByRole('heading',{name:'Nächste fünf Werktage'}).waitFor();
 await page.getByRole('button',{name:'＋ Gericht wählen'}).first().click();
 await page.getByRole('button',{name:/Hummus-Pilz-Schinken Baguette/}).click();
 const fits=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow');
 for (const width of [320,390,1024]) {
  await page.setViewportSize({width,height:844});
  await page.getByRole('button',{name:'Plan',exact:true}).click();await fits();
  await page.getByRole('button',{name:'Einkauf',exact:false}).last().click();
  await page.getByLabel('Artikel',{exact:true}).fill(`Zusätzlicher Kaffee ${width}`);
  await page.getByRole('button',{name:'Hinzufügen',exact:true}).click();
  await page.getByText(`Zusätzlicher Kaffee ${width}`,{exact:true}).waitFor();await fits();
  const rows=await page.locator('.shopping-row').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
  assert(rows.every(h=>h>=44&&h<=65));
  const deletes=await page.locator('.manual-actions button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));assert(deletes.every(h=>h>=44));
  await page.getByRole('button',{name:'Rezepte',exact:true}).click();await fits();
  await page.locator('.recipe-card').first().click();
  assert(await page.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth));
  await page.getByRole('button',{name:'Zutaten bearbeiten',exact:true}).click();
  assert(await page.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth));
  await page.getByRole('button',{name:'Dialog schließen'}).click();
 }
 console.log('PASS: /futter/ subpath login, assets, manual shopping writes, plan, recipes and ingredient editor at 320/390/1024px; no horizontal overflow; shopping rows and delete targets >=44px. Isolated data only.');
}finally{await browser.close();await new Promise(r=>server.close(r));close();}
