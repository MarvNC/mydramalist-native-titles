// ==UserScript==
// @name        MyDramaList Native Titles
// @match       https://mydramalist.com/*
// @grant       none
// @version     1.0
// @namespace   https://github.com/MarvNC
// @author      Marv
// @description Adds native titles to MyDramaList
// @grant       GM_setValue
// @grant       GM_getValue
// ==/UserScript==

let delayMs = 500;
let titles = GM_getValue('nativeTitles', {});

(async function () {
  const titleAnchors = [...document.querySelectorAll('a.title')];
  for (const titleAnchor of titleAnchors) {
    const url = titleAnchor.href;
    const nativeTitle = await getNativeTitle(url);
    if (nativeTitle) {
      titleAnchor.textContent = nativeTitle + ' | ' + titleAnchor.textContent;
    }
  }
})();

async function getNativeTitle(url) {
  if (titles[url]) {
    return titles[url];
  }
  console.log('Fetching native title for ' + url);
  const doc = await getUrl(url);
  const detailsDiv = doc.querySelector('div.show-detailsxss');
  const nativeTitleBold = [...detailsDiv.querySelectorAll('b.inline')].filter(
    (b) => b.textContent.trim() == 'Native Title:'
  );
  if (nativeTitleBold.length == 0) {
    console.error('Native title not found', url);
    return;
  }
  const nativeTitle = nativeTitleBold[0].nextElementSibling.textContent.trim();
  if (!nativeTitle) {
    console.error('Native title not found', url);
    return;
  }
  console.log(`${url} - ${nativeTitle}`);
  titles = GM_getValue('nativeTitles', {});
  titles[url] = nativeTitle;
  GM_setValue('nativeTitles', titles);
  return nativeTitle;
}

/**
 * Gets a URL and returns a promise that resolves to a document.
 * @param {string} url
 * @returns {Promise<Document>}
 */
async function getUrl(url) {
  let response = await fetch(url);
  let waitMs = delayMs;
  await timer(waitMs);
  while (!response.ok) {
    response = await fetch(url);
    waitMs *= 2;
    delayMs *= 1.2;
    delayMs = Math.round(delayMs);
    console.log(`Failed response on url ${url}, new wait:` + waitMs);
    await timer(waitMs);
  }
  const parser = new DOMParser();
  return parser.parseFromString(await response.text(), 'text/html');
}

/**
 * Returns a promise that resolves after a given number of milliseconds.
 * @param {int} ms
 * @returns
 */
async function timer(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
