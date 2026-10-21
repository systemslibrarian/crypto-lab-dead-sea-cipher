import {test,expect,type Page} from '@playwright/test';
import {boot,openEra,scan} from './gate';
async function open(page:Page){await boot(page,'dark');await openEra(page,'caesar');await expect(page.locator('#affine-text')).toBeVisible();}
const mod=(n:number)=>((n%26)+26)%26;
test('Affine displayed arithmetic and all ranked rows',async({page})=>{
 await open(page);const p=await page.locator('#affine-text').inputValue();const own=p.replace(/[a-z]/gi,c=>{const base=c>='a'?97:65;return String.fromCharCode(base+mod(7*(c.charCodeAt(0)-base)+3));});await expect(page.locator('#affine-cipher')).toHaveText(own);
 await expect(page.locator('[data-check="inverse"]')).toContainText('7 × 15 mod 26 = 1');expect(7*15%26).toBe(1);
 await page.locator('#affine-rank').click();await expect(page.locator('.affine-candidate')).toHaveCount(312);await expect(page.locator('.affine-candidate').first()).toHaveAttribute('data-a','7');
 await page.locator('#affine-solve').click();await expect(page.locator('#affine-solver')).toHaveAttribute('data-verdict','recovered');await expect(page.locator('#affine-solver')).toHaveClass('affine-alarm');expect(mod(7*3+3)).toBe(24);expect(mod(7*4+3)).toBe(5);
});
test('Affine negative claim: valid checks and frequency recovery together',async({page})=>{
 await open(page);await page.locator('#affine-rank').click();await expect(page.locator('#affine-checks [data-verdict="pass"]')).toHaveCount(3);await expect(page.locator('#affine-checks [data-verdict="fail"]')).toHaveCount(0);
 await expect(page.locator('#affine-verdict')).toHaveAttribute('data-verdict','recovered');await expect(page.locator('#affine-verdict')).toHaveClass('affine-alarm');await expect(page.locator('#affine-verdict')).toContainText('VALID KEY — AND RECOVERED BY FREQUENCY');await expect(page.locator('#affine-verdict')).toContainText('it is still one fixed letter for one fixed letter');
});
test('Affine invalid multipliers, impossible pairs, and third-pair mismatch',async({page})=>{
 await open(page);await page.locator('#affine-a').selectOption('2');await expect(page.locator('#affine-checks')).toContainText('13 distinct outputs');await page.locator('#affine-rank').click();await expect(page.locator('#affine-notice')).toContainText('Not decryptable');
 await page.locator('#affine-y2').fill('A');await page.locator('#affine-solve').click();await expect(page.locator('#affine-solver')).toHaveAttribute('data-verdict','NoAffineKey');await expect(page.locator('#affine-solver')).not.toContainText('key found');
 await page.locator('#affine-y2').fill('F');await page.locator('#affine-x3').fill('A');await page.locator('#affine-y3').fill('A');await page.locator('#affine-solve').click();await expect(page.locator('#affine-solver')).toHaveAttribute('data-verdict','third-mismatch');
});
test('Affine retirement, no-op, no letters, short texts and hidden probe',async({page})=>{
 await open(page);await page.locator('#affine-rank').click();await page.locator('#affine-a').selectOption('7');await expect(page.locator('#affine-ranking')).toBeVisible();await page.locator('#affine-a').selectOption('11');await expect(page.locator('#affine-ranking')).toBeHidden();await expect(page.locator('#affine-notice')).toContainText('retired');
 await page.locator('#affine-text').fill('123');await page.locator('#affine-rank').click();await expect(page.locator('#affine-notice')).toContainText('Nothing to measure');
 await page.locator('#affine-text').fill('DEAD SEA SCROLLS');await page.locator('#affine-rank').click();await expect(page.locator('#affine-notice')).toContainText('most likely');
 expect(await page.locator('[hidden]').evaluateAll(els=>els.every(e=>!(e as HTMLElement).getClientRects().length))).toBe(true);
});
for(const width of [1280,320])test(`Affine accessible states ${width}px`,async({page})=>{
 test.setTimeout(300000);await open(page);await page.setViewportSize({width,height:900});await scan(page,`affine default ${width}`);
 await page.locator('#affine-a').selectOption('2');await scan(page,`affine inadmissible ${width}`);
 await page.locator('#affine-a').selectOption('7');await page.locator('#affine-rank').click();await scan(page,`affine ranking and negative fixture ${width}`);
 await page.locator('#affine-y2').fill('A');await page.locator('#affine-solve').click();await scan(page,`affine impossible ${width}`);
});
