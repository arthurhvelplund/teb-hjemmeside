import {api, showMessage} from './portal-api.js';
import {newsCards} from './association-news.js';
const root = document.querySelector('#association-news-feed');
async function load() {
  try { const {posts} = await api('/posts?kind=news'); root.innerHTML = newsCards(posts); }
  catch(error) {
    root.replaceChildren(); showMessage(root, 'Nyhederne kunne ikke hentes. Prøv igen.', true);
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Prøv igen';
    retry.addEventListener('click', load); root.append(retry);
  }
}
load();
