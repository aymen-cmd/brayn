const API = '/api';
const LS_KEY = 'lbs_last_book';

function el(sel){return document.querySelector(sel)}
function on(el, ev, fn){el.addEventListener(ev, fn)}

const LS_THEME_KEY = 'lbs_theme';
function loadTheme() {
  const saved = localStorage.getItem(LS_THEME_KEY);
  const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('dark', saved ? saved === 'dark' : preferred);
}
function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem(LS_THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light');
}

async function getJSON(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Accept': 'application/json', ...(opts.headers || {}) },
    ...opts
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function renderCover(cover, title, size = 200) {
  if (!cover) return '';
  const src = cover.startsWith('data:') ? cover : (cover.startsWith('/covers/') ? cover : `/covers/${cover}`);
  return `<img src="${src}" alt="${escapeHtml(title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.parentNode.innerHTML='<div class=\\'cover-placeholder\\' style=\\'width:${size}px;height:${size * 1.5}px\\'><i class=\\'fas fa-image\\'></i></div>'">`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g, '&quot;');
}

async function renderBookLists() {
  const featuredGrid = el('#featured-carousel');
  const newGrid = el('#new-releases-grid');
  const allGrid = el('#all-books-grid');

  try {
    const [featuredRes, newRes, allRes, statsRes] = await Promise.all([
      getJSON('/books/featured'),
      getJSON('/books/new-releases'),
      getJSON('/books?size=500'),
      getJSON('/stats').catch(() => ({ totalBooks: 0, finished: 0, reading: 0, wantToRead: 0 }))
    ]);

    const featured = featuredRes?.books || [];
    const newReleases = newRes?.books || [];
    const all = allRes?.books || [];

    if (featuredGrid) renderCarousel(featured, featuredGrid);
    if (newGrid) renderGrid(newReleases.slice(0, 8), newGrid);
    if (allGrid) renderGrid(all, allGrid);

    const elTotal = el('#stat-total');
    const elReading = el('#stat-reading');
    const elFinished = el('#stat-finished');
    const elWant = el('#stat-want');
    if (elTotal) elTotal.textContent = String(statsRes.totalBooks || 0);
    if (elReading) elReading.textContent = String(statsRes.reading || 0);
    if (elFinished) elFinished.textContent = String(statsRes.finished || 0);
    if (elWant) elWant.textContent = String(statsRes.wantToRead || 0);
  } catch (err) {
    console.error('Failed to load book lists', err);
    if (allGrid) allGrid.innerHTML = `<div class="card" style="grid-column: 1/-1; padding: 20px;">Failed to load books: ${escapeHtml(err.message)}</div>`;
  }
}

function renderCarousel(books, container) {
  if (!books.length) {
    container.innerHTML = `<div class="card" style="grid-column:1/-1;padding:20px">No featured books yet.</div>`;
    return;
  }
  container.innerHTML = `
    <div class="carousel-track" style="display:flex; gap:18px; overflow-x:auto; padding: 10px 2px; scroll-snap-type: x mandatory;">
      ${books.map(book => `
        <div class="card" style="min-width:220px; max-width:240px; flex-shrink:0; scroll-snap-align:start; cursor:pointer;" onclick="openBook(${book.id})">
          <div class="card-media">${renderCover(book.coverUrl, book.title)}</div>
          <div class="card-body">
            <h3>${escapeHtml(book.title)}</h3>
            <p class="author">${escapeHtml(book.author)}</p>
            <div class="meta"><i class="fas fa-star"></i> Featured</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderGrid(books, container) {
  if (!books.length) {
    container.innerHTML = `<div class="card" style="grid-column:1/-1;padding:20px">No books found.</div>`;
    return;
  }
  container.innerHTML = books.map(book => `
    <div class="card" onclick="openBook(${book.id})" style="cursor:pointer">
      <div class="card-media">${renderCover(book.coverUrl, book.title)}</div>
      <div class="card-body">
        <h3>${escapeHtml(book.title)}</h3>
        <p class="author">${escapeHtml(book.author)}</p>
        <div class="meta">
          ${book.genre ? `<span><i class="fas fa-tag"></i> ${escapeHtml(book.genre)}</span>` : ''}
          ${book.pageCount ? `<span><i class="fas fa-file"></i> ${book.pageCount}p</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function openBook(id) {
  try {
    const data = await getJSON(`/books/${id}`);
    if (!data?.book) return alert('Book not found');
    const book = data.book;
    const coverSrc = book.coverUrl
      ? book.coverUrl.startsWith('data:')
        ? book.coverUrl
        : book.coverUrl.startsWith('/covers/')
          ? book.coverUrl
          : `/covers/${book.coverUrl}`
      : '';
    el('#detail-cover').src = coverSrc;
    el('#detail-title').textContent = book.title;
    el('#detail-author').textContent = book.author;
    el('#detail-genre').textContent = book.genre || 'Unknown';
    el('#detail-pages').textContent = book.pageCount ? `${book.pageCount} pages` : '';
    const descEl = el('#detail-description');
    if (descEl) descEl.textContent = book.description || '';
    const detailPage = el('#book-detail-page');
    if (detailPage) {
      detailPage.dataset.bookId = book.id;
      detailPage.dataset.filePath = book.filePath || '';
      detailPage.dataset.description = book.description || '';
      detailPage.dataset.contentSnapshot = book.contentSnapshot || '';
    }
    showPage('book-detail-page');
  } catch (err) {
    console.error(err);
    alert('Could not load book detail');
  }
}

function downloadBook() {
  const detailPage = document.getElementById('book-detail-page');
  const filePath = detailPage ? String(detailPage.dataset.filePath || '').trim() : '';
  const title = String(el('#detail-title')?.textContent || 'book').trim();
  if (!filePath) { alert('No downloadable PDF for this book yet.'); return; }
  const a = document.createElement('a');
  a.href = filePath;
  a.download = `${title.replace(/[^a-zA-Z0-9-_]+/g, '_')}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function openExternalReader() {
  const detailPage = document.getElementById('book-detail-page');
  const filePath = detailPage ? encodeURIComponent(String(detailPage.dataset.filePath || '').trim()) : '';
  const title = encodeURIComponent(String(el('#detail-title')?.textContent || 'book').trim());
  if (!filePath) { alert('No PDF available to read.'); return; }
  location.href = `/reader.html?file=${filePath}&title=${title}`;
}

function showPage(id) {
  const hash = document.location.hash;
  const landingIds = new Set(['landing-page','featured','new-releases','categories','all-books-section']);
  if (id === 'landing-page' && landingIds.has(hash.replace('#',''))) {
    document.location.hash = hash;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  if (hash) {
    const anchor = document.querySelector(hash);
    if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function goBack() { showPage('landing-page'); }

async function renderCategoryMenuList() {
  const navList = el('#category-menu-list');
  if (!navList) return;
  try {
    const data = await getJSON('/books?size=500');
    const all = data?.books || [];
    const genres = Array.from(new Set(all.map(b => b.genre).filter(Boolean))).filter(g => /^[A-Za-z0-9 &()-]+$/.test(g));
    if (!genres.length) {
      navList.innerHTML = `<div style="padding:14px;color:var(--text-secondary,#5b6478);font-size:13px">No categories yet.</div>`;
      return;
    }
    navList.innerHTML = genres.slice(0, 20).map(g => `
      <button onclick="openCategoryIndexPage('${escapeHtml(g)}')" style="display:flex;width:100%;align-items:center;gap:10px;padding:12px 14px;border:none;background:transparent;color:inherit;font-size:15px;cursor:pointer;text-align:left">
        <i class="fas fa-tag" style="opacity:.7;width:18px;text-align:center"></i>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(g)}</span>
        <i class="fas fa-chevron-right" style="opacity:.4;font-size:12px"></i>
      </button>
    `).join('');
  } catch (err) {
    navList.innerHTML = `<div style="padding:14px;color:var(--text-secondary,#5b6478);font-size:13px">Failed to load categories.</div>`;
  }
}

async function openCategoryIndexPage(genre) {
  const menu = el('#category-menu');
  if (menu) menu.style.display = 'none';
  const data = await getJSON(`/books?genre=${encodeURIComponent(genre)}`);
  const grid = el('#category-index-grid');
  const title = el('#category-index-title');
  if (!grid) return;
  if (title) title.textContent = genre;
  if (!data?.books?.length) {
    grid.innerHTML = `<div class="card" style="grid-column:1/-1;padding:20px">No books in "${escapeHtml(genre)}"</div>`;
  } else {
    renderGrid(data.books, grid);
  }
  showPage('category-index-page');
}

async function doSearch(q) {
  const data = await getJSON(`/books?q=${encodeURIComponent(q)}`);
  const landing = el('#landing-page');
  if (!landing) return;
  const existing = el('#search-results-area');
  if (existing) existing.remove();
  const resultsArea = document.createElement('div');
  resultsArea.id = 'search-results-area';
  resultsArea.className = 'section';
  resultsArea.innerHTML = `
    <div class="container">
      <h2 class="section-title"><i class="fas fa-search"></i> Search Results</h2>
      <div class="cards" id="search-results-grid"></div>
    </div>
  `;
  landing.prepend(resultsArea);
  const grid = el('#search-results-grid');
  if (!grid) return;
  if (!data.books.length) {
    grid.innerHTML = `<div class="card" style="grid-column:1/-1;padding:20px">No results for "${escapeHtml(q)}"</div>`;
  } else {
    renderGrid(data.books, grid);
  }
  resultsArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Reader state
let readerState = { bookId: null, mode: 'swipe', page: 1, totalPages: 100, pdfDoc: null, sources: [], day: true, font: 18, description: '', contentSnapshot: '' };
let touchState = { startX: 0, startY: 0 };

async function openReader(mode) {
  const bookEl = document.getElementById('book-detail-page');
  const bookId = Number(bookEl?.dataset.bookId);
  const filePath = String(bookEl?.dataset.filePath || '').trim();
  if (!bookId) return alert('Select a book first');

  readerState.bookId = bookId;
  readerState.mode = mode;
  readerState.pdfDoc = null;
  readerState.sources = [];
  readerState.day = true;
  readerState.font = 18;
  setDayNight(true);
  el('#reader-content').style.fontSize = readerState.font + 'px';
  readerState.page = 0;

  const modal = el('#reader-modal');
  modal.classList.add('open');
  if (mode === 'fullscreen') toggleFullscreen();

  try {
    const progressData = await getJSON(`/api/reader/progress/${bookId}`);
    readerState.page = Number(progressData.page || 1);
  } catch (e) {
    readerState.page = 1;
  }

  if (filePath) {
    await loadPdfIfSupported(filePath);
    if (readerState.pdfDoc) {
      const container = el('#reader-container');
      const content = el('#reader-content');
      container && container.classList.add('book-mode');
      content && content.classList.add('pdf-mode');
    }
  }

  readerState.description = String(document.getElementById('book-detail-page')?.dataset.description || '');
  readerState.contentSnapshot = String(document.getElementById('book-detail-page')?.dataset.contentSnapshot || '');
  renderReaderPage();
}

function closeReader() {
  saveProgress();
  const container = el('#reader-container');
  if (document.fullscreenElement && container.contains(document.fullscreenElement)) {
    (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
  }
  el('#reader-modal').classList.remove('open');
}

function toggleFullscreen() {
  const container = el('#reader-container');
  if (!document.fullscreenElement) {
    (container.requestFullscreen || container.webkitRequestFullscreen || (() => {})).call(container);
  } else {
    document.fullscreenElement && (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  }
}

function toggleDayNight() {
  setDayNight(!readerState.day);
}

function setDayNight(day) {
  readerState.day = day;
  const content = el('#reader-content');
  content.style.background = day ? '#ffffff' : '#12131a';
  content.style.color = day ? '#1f2330' : '#d6dbe8';
  el('#reader-container').style.background = day ? '#ffffff' : '#12131a';
  el('#reader-container').style.color = day ? '#1f2330' : '#d6dbe8';
}
function prevPage() {
  if (readerState.page <= 1) return;
  readerState.page--;
  renderReaderPage();
  attachSwipe();
  saveProgress();
}

function nextPage() {
  if (readerState.page >= readerState.totalPages) return;
  readerState.page++;
  renderReaderPage();
  attachSwipe();
  saveProgress();
}

function changeFont(delta) {
  readerState.font = Math.min(32, Math.max(12, readerState.font + delta * 2));
  el('#reader-content').style.fontSize = readerState.font + 'px';
}

async function loadPdfIfSupported(filePath) {
  try {
    if (typeof window.pdfjsLib === 'undefined') return;
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.pdfjsLib.GlobalWorkerOptions.workerSrc || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const res = await fetch(filePath);
    if (!res.ok) return;
    const blob = await res.blob();
    const pdf = await window.pdfjsLib.getDocument(await window.pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise).promise;
    readerState.pdfDoc = pdf;
    readerState.sources = [{ type: 'pdf', path: filePath }];
    readerState.totalPages = pdf.numPages;
  } catch (e) {
    console.warn('PDF preview fallback', e);
  }
}

async function renderReaderPage() {
  el('#page-indicator').textContent = `Page ${readerState.page} of ${readerState.totalPages}`;
  const pct = Math.round((readerState.page / Math.max(1, readerState.totalPages)) * 100);
  const filled = el('#progress-filled');
  if (filled) filled.style.width = `${pct}%`;

  const content = el('#reader-content');
  if (readerState.pdfDoc) {
    try {
      const page = await readerState.pdfDoc.getPage(readerState.page);
      const scale = 1.6;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      content.innerHTML = '';
      content.appendChild(canvas);
    } catch (err) {
      content.innerHTML = `<p>Unable to render page. ${escapeHtml(err.message)}</p>`;
    }
  } else if (readerState.sources.length) {
    content.innerHTML = `<p>This book has no readable text content.</p>`;
  } else {
    const raw = String(readerState.contentSnapshot || '');
    const words = raw.split(/\s+/).filter(Boolean);
    const perPage = 180;
    const totalPages = Math.max(1, Math.ceil(words.length / perPage));
    readerState.totalPages = totalPages;
    const start = Math.max(0, (readerState.page - 1) * perPage);
    const slice = words.slice(start, start + perPage).join(' ');
    content.innerHTML = `<p>${escapeHtml(slice || 'No book text added yet.')}</p>`;
    el('#page-indicator').textContent = `Page ${readerState.page} of ${totalPages}`;
    const pct = Math.round((readerState.page / Math.max(1, totalPages)) * 100);
    if (filled) filled.style.width = `${pct}%`;
  }
}

async function saveProgress() {
  try {
    await fetch(`${API}/reader/progress/${readerState.bookId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: readerState.page })
    });
  } catch (e) { console.warn(e); }
}

function attachSwipe() {
  const container = el('#reader-container');
  if (!container) return;
  container.ontouchstart = (e) => { touchState.startX = e.changedTouches[0].screenX; };
  container.ontouchend = (e) => {
    const dx = e.changedTouches[0].screenX - touchState.startX;
    if (Math.abs(dx) > 40) dx < 0 ? nextPage() : prevPage();
  };
  container.onclick = (e) => {
    if (e.target.closest('.reader-controls') || e.target.closest('.reader-progress')) return;
    const rect = el('#reader-content').getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    if (e.clientX < mid) prevPage(); else nextPage();
  };
}

function initApp() {
  loadTheme();
  renderBookLists();
  el('#search-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const q = el('#search-input').value.trim(); if (q) doSearch(q); } });
  el('#theme-toggle')?.addEventListener('click', toggleTheme);

  const menuBtn = el('#category-menu-btn');
  const menu = el('#category-menu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.style.display === 'block';
      menu.style.display = open ? 'none' : 'block';
    });
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && e.target !== menuBtn) menu.style.display = 'none';
    });
  }
  renderCategoryMenuList();

  document.addEventListener('keydown', (e) => {
    if (!el('#reader-modal')?.classList.contains('open')) return;
    if (e.key === 'Escape') closeReader();
    if (e.key === 'ArrowRight') nextPage();
    if (e.key === 'ArrowLeft') prevPage();
  });

  attachSwipe();

  let saveTimer = null;
  const origRender = renderReaderPage;
  window.renderReaderPage = async function() {
    await origRender();
    if (readerState.bookId) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveProgress, 200);
    }
  };

  window.addEventListener('popstate', () => {
    const path = window.location.pathname;
    if (path.startsWith('/admin')) {
      history.replaceState({ page: 'landing-page' }, '', '/');
    }
    el('#reader-modal')?.classList.remove('open');
    showPage('landing-page');
  });

  const detailMatch = window.location.pathname.match(/^\/books\/(\d+)$/);
  if (detailMatch) {
    const id = detailMatch[1];
    openBook(id).catch(err => {
      console.error('Failed to load book on initial route', err);
      showPage('landing-page');
    });
  }
}

document.addEventListener('DOMContentLoaded', initApp);
