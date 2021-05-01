const fs = require('fs');
const fetch = require('node-fetch');
const playwright = require('playwright');
const path = require('path')
let isRunning
let storePath

async function hrsCrawl(page, mw, setting, options, browser){
  await page.click('article a')
  mw.webContents.send('data:status', ['Fetching image...', '50%'])
  const imgUrls = []
  while (true){
    do {
      const isStop = await page.evaluate(async () => {
        const article = document.querySelectorAll('article')
        return !(!article || article.length < 2);

      });
      if (isStop){
        break
      }
    }while (true)
    await new Promise(resolve => setTimeout(resolve, 500))
    const arrowRight = await page.$('.coreSpriteRightPaginationArrow');
    const url = await page.evaluate(async () => {
      const article = document.querySelectorAll('article')
      if (!article || article.length < 2){
        return
      }
      const images = article[1].querySelectorAll('img');
      const img = Array.from(images).find((v) => !(v?.alt || '').includes('profile'));
      return img?.src;
    });
    url && imgUrls.push(url) &&
    mw.webContents.send('data:status', [`Fetching image ${options.limit ? `[${imgUrls.length}/${options.limit}]` : `[${imgUrls.length}]`}...`, '50%'])

    if (options.limit && (imgUrls.length > options.limit)){
      console.log('Reach the limit')
      break
    }
    console.log('Total image: ', imgUrls.length)
    if (!arrowRight){
      break
    }
    await page.click('.coreSpriteRightPaginationArrow')
  }
  console.log('Downloading...')
  mw.webContents.send('data:status', ['Downloading..', '75%'])
  await Promise.all(imgUrls.map((url, index) => download({ url, name: index + '_hrs' })))
  console.log('Done')
  mw.webContents.send('data:status', ['Done', '100%'])
  isRunning = false
  return imgUrls.length
}
async function normalCrawl(page, mw, setting, options, browser, pageNumber){
  // You can also take screenshots of pages
  let prevHg = 0
  let imgData = []
  console.log('Fetching...')
  mw.webContents.send('data:status', [`Fetching image ${pageNumber ? `- Page: ${pageNumber}` : ''}...`, '50%'])
  while (true){
    const hg = await page.evaluate('document.body.scrollHeight')
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    let start = Date.now()
    do {
      if (Date.now() - start > 3000){
        break
      }
      const presentHg = await page.evaluate('document.body.scrollHeight')
      if (presentHg > hg){
        break
      }
    }while (true)

    const data = await page.evaluate(async (setting) => {
      const images = document.querySelectorAll(`${setting.imgWrapper ? `.${setting.imgWrapper} ` : ''}img`);
      const urls = Array.from(images).map((v) => v.src);
      return urls;
    }, setting);
    console.log(hg, prevHg)

    imgData.push(...data)
    imgData = [...new Set(imgData)];
    mw.webContents.send('data:status', [`Fetching image ${pageNumber ? `- Page: ${pageNumber}` : ''} ${options.limit ? `[${imgData.length}/${options.limit}]` : `[${imgData.length}]`}...`, '50%'])
    try {
      if (options.limit && (imgData.length > options.limit)){
        console.log('Reach the limit')
        imgData.length = options.limit
        break
      }
    }catch (e) {
      console.log(e)
    }

    if ((hg === prevHg)) {
      break
    }
    prevHg = hg
  }

  console.log('Downloading...')
  mw.webContents.send('data:status', [`Downloading ${pageNumber ? `- Page: ${pageNumber}` : ''}..`, '75%'])
  await Promise.all(imgData.map((url, index) => download({ url, name: `${pageNumber ? `page${pageNumber}_` : ''}` + index })))
  mw.webContents.send('data:status', ['Done', '100%'])

  console.log('Done')
  return imgData.length
}

async function craw(insId, mw, setting, options){
  insId.length > 100 && insId.slice(0, 100)
  const insName = insId.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '');
  storePath = path.join(setting.path, insName)
  !fs.existsSync(storePath) && fs.mkdirSync(storePath, {recursive: true})

  const browser = options.viz ? await playwright['firefox'].launch({ headless: false, slowMo: 100 }) : await playwright['firefox'].launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    if (options.isInstagram) {
      await loginInstagram(mw, page, setting, insId)
    } else {
      await loginSite(mw, page, setting, insId)
    }
  } catch (e) {
    console.log('Login error', e)
    return {
      errorCode: 1
    }
  }

  try {
    if (options.highRes && options.isInstagram){
      return await hrsCrawl(page, mw, setting, options, browser)
    }else {
      if (setting.pageFormat){
        let nImg = 0
        for (let i = 1; i <= options.pageNumber; i++) {
          const url = !insId.includes(setting.pageFormat) ? (insId + setting.pageFormat + i) : insId
          await page.goto(url)
          const cnt = await normalCrawl(page, mw, setting, options, browser, i)
          nImg += cnt
        }
        return nImg
      }else{
        return await normalCrawl(page, mw, setting, options, browser)
      }
    }
  }catch (e) {
    console.log(e)
  }finally {
    browser.close();
  }

}

async function loginSite(mw, page, setting, insId) {
  console.log('Login site')
  const re = new RegExp("^(http|https)://", "i");
  const siteUrl = (re.test(insId) ? '' : 'http://') + insId
  await page.goto(siteUrl);
  const isNeedLogin = await Promise.race([
    page.waitForSelector('[type=password]', {
      state: 'visible'
    }),
    new Promise(resolve => setTimeout(() => resolve(false), 1000))
  ])

  if (!isNeedLogin){
    return
  }
  if (!setting.username || !setting.password){
    throw new Error('login info is empty.')
  }
  const loginData = await page.evaluate(() => {
    const input = document.querySelectorAll('input')
    if (!input.length){
      return ''
    }
      const pwIdx = Array.from(input).findIndex(i => i.type === 'password')
      console.log(pwIdx)
      if (!pwIdx){
        return ''
      }
      const formClassName = document.querySelector('[type=password]').closest('form').className
      return {
        userNameType: input[pwIdx - 1].name,
        formClassName
      }
  })
  const {userNameType, formClassName} = loginData
  try {
    await page.type(`[name=${userNameType}]`, setting.username)
    await page.type('[type="password"]', setting.password)
    await page.click(`form.${formClassName}  button`)
    await page.waitForSelector('body')
  }catch (e) {
    console.log(e)
  }
}

async function loginInstagram(mw, page, setting, insId){
  if (!setting.username || !setting.password){
    throw new Error('login info is empty.')
  }
  await page.goto('https://www.instagram.com/');
  await page.waitForSelector('[name=username]', {
    state: 'visible'
  })
  await page.type('[name=username]', setting.username)
  await page.type('[type="password"]', setting.password)
  await page.click('[type=submit]')
  await page.waitForSelector('[placeholder=Search]', { state: 'visible' })
  mw.webContents.send('data:status', ['Logged in', '25%'])
  console.log('Logged in')
  await page.goto(`https://www.instagram.com/${insId}`)
}

async function download(data) {
  try {
    const response = await fetch(data.url);
    const buffer = await response.buffer();
    fs.writeFile(`${storePath}/${data.name}.jpg`, buffer, () =>
      true);
  }catch (e) {
    console.log(e)
  }
}

module.exports = {
  craw
}