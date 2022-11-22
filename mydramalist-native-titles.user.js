// ==UserScript==
// @name        MyDramaList Native Titles
// @match       https://mydramalist.com/*
// @grant       none
// @version     1.11
// @namespace   https://github.com/MarvNC
// @author      Marv
// @description Adds native titles to MyDramaList
// @grant       GM_setValue
// @grant       GM_getValue
// ==/UserScript==

let delayMs = 500;
let nativeTitles = GM_getValue('nativeTitles', {});
const staffRegex = /.+\bmydramalist\.com\/people\/\d+.+/;
const dramaRegex = /.+\bmydramalist\.com\/\d+.+/;

(async function () {
  // replace the title for the current page if it's a drama or staff page
  const nativeTitle = await getNativeTitle(document.URL);
  if (nativeTitle) {
    const titleElem = document.querySelector('h1');
    titleElem.textContent = nativeTitle + ' | ' + titleElem.textContent;
  }
  // replace for all links on the page
  const titleAnchors = [...document.querySelectorAll('a.title')];
  const staffAnchors = [...document.querySelectorAll('a[href].text-primary')].filter((a) =>
    staffRegex.test(a.href)
  );
  for (const titleAnchor of [...titleAnchors, ...staffAnchors]) {
    const url = titleAnchor.href;
    const nativeTitle = await getNativeTitle(url);
    if (nativeTitle) {
      let textElem = titleAnchor;
      if (titleAnchor.firstElementChild) textElem = titleAnchor.firstElementChild;
      textElem.textContent = nativeTitle + ' | ' + textElem.textContent;
    }
  }
})();

/**
 * Returns the native title from a drama or staff page.
 * @param {string} url
 * @returns the native title or null if not found
 */
async function getNativeTitle(url) {
  if (nativeTitles[url]) {
    return nativeTitles[url];
  }
  let nativeTitle;
  console.log('Fetching native title for ' + url);
  const doc = await getUrl(url);
  if (staffRegex.test(url)) {
    const detailsBox = [...doc.querySelectorAll('div.box-header.primary')].filter(
      (div) => div.innerText == 'Details'
    )[0]?.nextElementSibling;
    nativeTitle = [...detailsBox.querySelectorAll('b.inline')]
      .filter((b) => b.innerText === 'Native name:')[0]
      ?.nextSibling.textContent.trim();
    if (!nativeTitle) {
      console.error('No native title found for ' + url);
      return;
    }
  } else if (dramaRegex.test(url)) {
    const detailsDiv = doc.querySelector('div.show-detailsxss');
    const nativeTitleBold = [...detailsDiv?.querySelectorAll('b.inline')].filter(
      (b) => b.textContent.trim() == 'Native Title:'
    );
    if (nativeTitleBold.length == 0) {
      console.error('Native title not found', url);
      return;
    }
    nativeTitle = nativeTitleBold[0].nextElementSibling.textContent.trim();
    if (!nativeTitle) {
      console.error('Native title not found', url);
      return;
    }
  }
  console.log(`${url} - ${nativeTitle}`);
  // store to storage
  nativeTitles = GM_getValue('nativeTitles', {});
  nativeTitles[url] = nativeTitle;
  GM_setValue('nativeTitles', nativeTitles);
  return nativeTitle;
}

/**
 * Gets a URL and returns a promise that resolves to a document.
 * @param {string} url
 * @returns {Promise<Document>}
 */
async function getUrl(url) {
  if (url == document.URL) {
    return document;
  }
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
