const fs = require('fs');
const fetch = require('node-fetch');
const playwright = require('playwright');
const path = require('path')
const { exec } = require('child_process');
let storePath
const {app} = require('electron')

async function facebookGroupCrawl(keyword, page, mw, setting, options, browser, maxPages) {
  console.log('Fetching...');
  const { limit = 100, grMemberMin = 0, grMemberMax = 0 } = options;
  let allGroups = [];
  let pageNumber = 0;
  let previousHeight;
  const deduplicate = {}
  await page.goto(`https://www.facebook.com/search/groups/?q=${keyword}`, { waitUntil: 'networkidle' });
  while (allGroups.length < limit) {
    mw.webContents.send('data:status', [`Crawled groups: ${allGroups.length}...`, '50%']);
    let newGroups;
    try {
      newGroups = await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        const feed = document.querySelectorAll('[role="feed"]');
        const groupElements = Array.from(feed[0].querySelectorAll('[role="article"]'));
        const groupData = [];
        groupElements.forEach(group => {
          const name = group.querySelector('[role="presentation"]').innerText;
          const url = group.querySelector('[role="presentation"]').href;
          const span = group.querySelectorAll('span');
          const otherInfo = [
            span[2].innerText,
            span[3].innerText,
          ];
          if (name && url) {
            groupData.push({ name, url, otherInfo });
          }
        });
        return groupData;
      });

      newGroups = newGroups.reduce((acc, group) => {
        const numString = group.otherInfo?.[0]?.split(' · ')?.[1]?.split(' ')?.[0] || '';

        let groupNumber = parseInt(numString.endsWith('K') ? parseFloat(numString) * 1000 : parseFloat(numString));

        if (grMemberMin && groupNumber < grMemberMin) {
          return acc;
        }

        if (grMemberMax && groupNumber > grMemberMax) {
          return acc;
        }

        if (
          !deduplicate[group.url]
        ) {
          deduplicate[group.url] = true;
          acc.push(group);
        }
        return acc;
      }, [])

      allGroups = [...allGroups, ...newGroups];

      previousHeight = await page.evaluate('document.body.scrollHeight');
      await page.waitForTimeout(2000); // Wait for 2 seconds to load new data
      let newHeight = await page.evaluate('document.body.scrollHeight');

      // If the height doesn't change, we're at the bottom of the page
      if (newHeight === previousHeight) {
        break;
      }

    } catch (error) {
      console.error('Error while scrolling or fetching data:', error);
    }

    pageNumber++;
  }

  mw.webContents.send('data:status', [`Done - Groups: ${allGroups.length}...`, '100%']);

  allGroups.length > limit && (allGroups = allGroups.slice(0, limit))
  const htmlFileName = `${
    (keyword || '').toLowerCase().replaceAll(' ', '')
  }_${limit}_${grMemberMin}_${grMemberMax}.html`;
  const outputFilePath = path.join(setting.path, htmlFileName);
  fs.writeFileSync(outputFilePath, generateHtml(allGroups, keyword));

  // Open the HTML file after writing to it
  exec(`open ${outputFilePath}`);

  return allGroups;
}

function generateHtml(groups, keyword) {
  let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Facebook Groups with keyword ${keyword}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
    }
    .group {
      margin-bottom: 20px;
    }
    .group-name {
      font-size: 1.2em;
      font-weight: bold;
    }
    .group-url {
      color: blue;
    }
  </style>
</head>
<body>
  <h2>Facebook Groups with keyword ${keyword}</h2>
  ${groups.map(group => `
    <div class="group">
      <div class="group-name">Name: ${group.name}</div>
      <div class="group-url">URL: <a href="${group.url}" target="_blank">${group.url}</a></div>
      <div class="group-other-info">Other Info: ${group.otherInfo.join(', ')}</div>
    </div>
  `).join('')}
</body>
</html>
  `;
  return htmlContent;
}

async function craw(insId, mw, setting, options){
  insId.length > 100 && insId.slice(0, 100)
  const insName = insId.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '');
  storePath = path.join(setting.path, insName)
  !fs.existsSync(storePath) && fs.mkdirSync(storePath, {recursive: true})

  const browser = options.viz ? await playwright['chromium'].launch({ headless: false, slowMo: 100 }) : await playwright['chromium'].launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginSite(mw, page, setting, insId)
  } catch (e) {
    console.log('Login error', e)
    return {
      errorCode: 1
    }
  }

  try {
    await facebookGroupCrawl(insId, page, mw, setting, options, browser, 0)
  }catch (e) {
    console.log(e)
  }finally {
    browser.close();
  }

}

async function loginSite(mw, page, setting, insId) {
  const sessionFileName = `${(setting.name || '').toLowerCase().replaceAll(' ', '')}_session.json`
  const SESSION_FILE = path.join(app.getAppPath(), 'storage', sessionFileName);

  // Load existing session state if available
  if (fs.existsSync(SESSION_FILE)) {
    const sessionState = JSON.parse(fs.readFileSync(SESSION_FILE));
    await page.context().addCookies(sessionState.cookies);
  }

  mw.webContents.send('data:status', [`Accessing ${setting.domain}...`, '10%']);
  await page.goto(setting.domain);
  const isNeedLogin = await Promise.race([
    page.waitForSelector('[type=password]', {
      state: 'visible'
    }),
    new Promise(resolve => setTimeout(() => resolve(false), 1000))
  ]);

  if (!isNeedLogin) {
    return;
  }

  if (!setting.username || !setting.password) {
    throw new Error('login info is empty.');
  }

  mw.webContents.send('data:status', [`Login with ${setting.username}...`, '15%']);
  const loginData = await page.evaluate(() => {
    const input = document.querySelectorAll('input');
    if (!input.length) {
      return '';
    }
    const pwIdx = Array.from(input).findIndex(i => i.type === 'password');
    if (!pwIdx) {
      return '';
    }
    const formClassName = document.querySelector('[type=password]').closest('form').className;
    return {
      userNameType: input[pwIdx - 1].name,
      formClassName,
    };
  });

  const { userNameType, formClassName } = loginData;
  try {
    await page.type(`[name=${userNameType}]`, setting.username);
    await page.type('[type="password"]', setting.password);
    await page.click(`form.${formClassName} button`);
    await page.waitForSelector('body');
    mw.webContents.send('data:status', [`Login success`, '20%']);

    // Save session state after successful login
    const cookies = await page.context().cookies();
    const storageState = await page.context().storageState();
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies, origins: storageState.origins }));
    console.log('Session saved.');
  } catch (e) {
    console.log(e);
  }
}

module.exports = {
  craw
}
