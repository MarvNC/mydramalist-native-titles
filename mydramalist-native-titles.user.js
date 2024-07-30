// ==UserScript==
// @name        MyDramaList Native Titles
// @match       https://mydramalist.com/*
// @grant       none
// @version     1.4.1
// @namespace   https://github.com/MarvNC
// @author      Marv
// @description Adds native titles to MyDramaList
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_registerMenuCommand
// ==/UserScript==

let showEnglishTitles = GM_getValue('showEnglishTitles', true);
let delayMs = 500;
let nativeTitles = GM_getValue('nativeTitles', {});
const staffRegex = /^https?:\/\/\bmydramalist\.com\/people\/\d+[^/]+$/;
const dramaRegex = /^https?:\/\/\bmydramalist\.com\/\d+[^/]+$/;

// Register menu command to toggle showEnglishTitles
GM_registerMenuCommand('Toggle English Titles', toggleEnglishTitles);

function toggleEnglishTitles() {
  showEnglishTitles = !showEnglishTitles;
  GM_setValue('showEnglishTitles', showEnglishTitles);
  alert(`English titles are now ${showEnglishTitles ? 'shown' : 'hidden'}`);
  // Reload the page to apply changes
  location.reload();
}

(async function () {
  // replace the title for the current page if it's a drama or staff page
  const nativeTitle = await getNativeTitle(document.URL);
  if (nativeTitle) {
    const titleElem = document.querySelector('h1');
    const englishTitle = titleElem.textContent;
    titleElem.textContent = nativeTitle;
    if (showEnglishTitles) titleElem.textContent += ' | ' + englishTitle;
  }
  // replace for all links on the page
  const titleAnchors = [
    ...document.querySelectorAll('a.title'),
    ...document.querySelectorAll('.text-primary.title > a[href]'),
    ...document.querySelectorAll('a[href].text-primary'),
  ];
  const staffAnchors = [...document.querySelectorAll('a[href].text-primary')].filter((a) =>
    staffRegex.test(a.href)
  );
  // filter to unique links
  const allTitleAnchors = Array.from(new Set([...titleAnchors, ...staffAnchors])).filter(
    (anchor) => staffRegex.test(anchor.href) || dramaRegex.test(anchor.href)
  );
  console.log('Found ' + allTitleAnchors.length + ' title anchors');
  console.log(allTitleAnchors.map((a) => a.href));

  const notInCache = [];

  // replace ones already in cache first
  for (const titleAnchor of allTitleAnchors) {
    const nativeTitle = nativeTitles[titleAnchor.href];
    if (nativeTitle) {
      console.log(`Found ${titleAnchor.href} in cache`);
      replaceTitle(titleAnchor, nativeTitle);
    } else {
      notInCache.push(titleAnchor);
    }
  }
  console.log('Fetching ' + notInCache.length + ' titles not in cache');
  for (const titleAnchor of notInCache) {
    const url = titleAnchor.href;
    const nativeTitle = await getNativeTitle(url);
    console.log(`Got title for ${url} - ${nativeTitle}`);
    if (nativeTitle) {
      replaceTitle(titleAnchor, nativeTitle);
    } else {
      console.log('No native title found for ' + url);
    }
  }
})();

function replaceTitle(titleAnchor, nativeTitle) {
  let textElem = titleAnchor;
  if (titleAnchor.firstElementChild) textElem = titleAnchor.firstElementChild;
  const englishTitle = textElem.textContent
  textElem.textContent = nativeTitle;
  if (showEnglishTitles) textElem.textContent += ' | ' + englishTitle;
}

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
  if (!staffRegex.test(url) && !dramaRegex.test(url)) {
    return;
  }
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
