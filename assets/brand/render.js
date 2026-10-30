// Renders the Sugar Saathi icon set from mark.js (needs Playwright + Chrome):
//   PW=admin/node_modules/playwright node assets/brand/render.js assets/images
// (also writes preview-round.png: delete it from the output folder afterwards).
const { chromium } = require(process.env.PW);
const { mark, background } = require('./mark.js');
const out = process.argv[2];
const svg = (body, scale = 1) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${body}</g></svg>`;
// Full icon: mark shifted up a touch so the drop + heart sit optically centred.
const full = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${background}<g transform="translate(512 512) scale(0.96) translate(-512 -478)">${mark()}</g></svg>`;
const jobs = [
  ['icon.png', full, 1024, false],
  ['favicon.png', full, 48, false],
  ['android-icon-background.png', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${background}</svg>`, 512, false],
  // Adaptive foreground: keep everything inside the central 66% safe circle (launchers crop the rest).
  ['android-icon-foreground.png', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><g transform="translate(512 512) scale(0.7) translate(-512 -470)">${mark()}</g></svg>`, 512, true],
  ['android-icon-monochrome.png', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><g transform="translate(512 512) scale(0.7) translate(-512 -470)">${mark(true)}</g></svg>`, 432, true],
  ['splash-icon.png', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><g transform="translate(512 512) scale(0.95) translate(-512 -470)">${mark()}</g></svg>`, 512, true],
  ['preview-round.png', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><clipPath id="c"><circle cx="512" cy="512" r="512"/></clipPath><g clip-path="url(#c)">${background}<g transform="translate(512 512) scale(0.7) translate(-512 -470)">${mark()}</g></g></svg>`, 512, true],
];
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  for (const [name, s, size, transparent] of jobs) {
    await page.setViewportSize({ width: 1024, height: 1024 });
    await page.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
    await page.screenshot({ path: `${out}/${name}`, omitBackground: transparent, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
    if (size !== 1024) require('child_process').execFileSync('sips', ['-Z', String(size), `${out}/${name}`], { stdio: 'ignore' });
    console.log('wrote', name, size);
  }
  await browser.close();
})();
