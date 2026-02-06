// ==UserScript==
// @name        MyDramaList Native Titles
// @match       https://mydramalist.com/*
// @version     1.4.3
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
const dramaRegex = /^https?:\/\/\bmydramalist\.com\/\d+[^/]+.*$/;
const recommendationRegex = /^https?:\/\/\bmydramalist\.com\/recommendations\/?.*$/;

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

  // wait for recommendations content to load before continuing
  if (recommendationRegex.test(document.URL)) {
    pageLoadObserver.observe(document.body, { subtree: true, childList: true });
    return;
  }

  replacePageContents();
})();

let cancel = false;
let running = false;
async function replacePageContents() {
  running = true;
    // replace for all links on the page
  const titleAnchors = [
    ...document.querySelectorAll('a.title'),
    ...document.querySelectorAll('.text-primary.title > a[href]'),
    ...document.querySelectorAll('a[href].text-primary'),
  ];
  const staffAnchors = [...document.querySelectorAll('a[href].text-primary')].filter((a) =>
    staffRegex.test(a.href)
  );
  const recommendationAnchors = [...document.querySelectorAll('div.film-title > a')];
  // filter to unique links
  const allTitleAnchors = Array.from(new Set([...titleAnchors, ...staffAnchors, ...recommendationAnchors])).filter(
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
    if (cancel) {
      console.log('Cancelling due to page switch...');
      running = false;
      cancel = false;
      return;
    }
    const url = titleAnchor.href;
    const nativeTitle = await getNativeTitle(url);
    console.log(`Got title for ${url} - ${nativeTitle}`);
    if (nativeTitle) {
      replaceTitle(titleAnchor, nativeTitle);
    } else {
      console.log('No native title found for ' + url);
    }
  }
}

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
  if (!staffRegex.test(url) && !dramaRegex.test(url) && !recommendationRegex.test(url)) {
    return;
  }
  console.log('Fetching native title for ' + url);
  const doc = await getUrl(url);
  if (doc === null) {
    console.error('No details page found for ' + url);
    return;
  }
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
    if (!detailsDiv) {
      console.error('Native title not found', url);
      return;
    }
    const nativeTitleBold = [...detailsDiv.querySelectorAll('b.inline')].filter(
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
    if (cancel || waitMs > 5000) return null;
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

function PageLoadObserverCallback(mutations) {
  mutations.forEach(function(mutation) {
    var pagination = document.querySelector('ul.el-pager');

    if (!pagination)
      return;

    pageLoadObserver.disconnect();

    loadingMaskObserver.observe(document.querySelector('div.el-loading-mask'), {
      attributes: true,
      attributeFilter: ['class']
    });

    replacePageContents();
  });
}

let replaceAfterLoading; // can't replace page contents if they haven't loaded yet

function LoadingMaskObserverCallback(mutations) {
  mutations.forEach(function(mutation) {
    const loading = mutation.target.classList.contains('el-loading-fade');
    if (!loading && !running) {
      replacePageContents();
      return;
    }

    replaceAfterLoading ??= setInterval(async function(){
      const loading = document.querySelector('div.el-loading-mask').classList.contains('el-loading-fade');
      if (loading) return;

      clearInterval(replaceAfterLoading);
      replaceAfterLoading = null;
      if (running) cancel = true;
      replacePageContents();
    }, 500);
  });
}
