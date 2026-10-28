// Dev-only: find the exact chain of elements causing horizontal overflow.
import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://localhost:8080/docs.html';
const width = Number(process.argv[3] || 360);

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width, height: 800 });
await page.goto(url, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));

const report = await page.evaluate((vw) => {
  const out = [];
  // An element only causes document overflow if none of its ancestors clip
  // horizontally (overflow hidden/auto/scroll).
  const isClipped = (node) => {
    let current = node.parentElement;
    while (current && current !== document.documentElement) {
      const style = getComputedStyle(current);
      if (style.overflowX !== 'visible' || style.overflow !== 'visible') return true;
      current = current.parentElement;
    }
    return false;
  };

  document.querySelectorAll('body *').forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.right <= vw + 0.5 && rect.width <= vw + 0.5) return;
    if (isClipped(node)) return;
    const chain = [];
    let current = node;
    while (current && current !== document.body) {
      const style = getComputedStyle(current);
      chain.push(
        `${current.tagName.toLowerCase()}${current.id ? `#${current.id}` : ''}` +
          `${current.className && typeof current.className === 'string' ? `.${current.className.split(' ').join('.')}` : ''}` +
          ` [w=${Math.round(current.getBoundingClientRect().width)} overflowX=${style.overflowX} minW=${style.minWidth} display=${style.display}]`
      );
      current = current.parentElement;
    }
    out.push({
      node: `${node.tagName}.${String(node.className).slice(0, 40)}`,
      width: Math.round(rect.width),
      right: Math.round(rect.right),
      chain,
    });
  });
  return {
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: out.slice(0, 4),
  };
}, width);

console.log(JSON.stringify(report, null, 1));
await browser.close();
