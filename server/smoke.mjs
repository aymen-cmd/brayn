import http from 'http';

const BASE = 'http://127.0.0.1:3000';

function req(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      method: opts.method || 'GET',
      headers: opts.headers || {},
      followRedirect: false
    };
    const request = http.request(url, options, (response) => {
      let data = '';
      response.on('data', chunk => (data += chunk));
      response.on('end', () => {
        let parsed = null;
        const ct = response.headers['content-type'] || '';
        if (ct.includes('application/json')) {
          try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        } else {
          parsed = data;
        }
        resolve({ status: response.statusCode, headers: response.headers, data: parsed });
      });
    });
    request.on('error', reject);
    if (opts.body) request.write(opts.body);
    request.end();
  });
}

async function run() {
  const cookieJar = '';

  const test = await req('/api/test');
  console.log('Test:', test.status, test.data.message ? 'OK' : 'FAIL');

  const books = await req('/api/books');
  console.log('Books:', books.status, Array.isArray(books.data.books) ? `${books.data.books.length} items` : 'FAIL');

  const featured = await req('/api/books/featured');
  console.log('Featured:', featured.status, Array.isArray(featured.data.books) ? `${featured.data.books.length} items` : 'FAIL');

  const newReleases = await req('/api/books/new-releases');
  console.log('New Releases:', newReleases.status, Array.isArray(newReleases.data.books) ? `${newReleases.data.books.length} items` : 'FAIL');

  const one = await req('/api/books/1');
  console.log('Book 1:', one.status, one.data.book ? one.data.book.title : 'FAIL');

  const progress = await req('/api/reader/progress/1');
  console.log('Progress:', progress.status, progress.data.page ? `page ${progress.data.page}` : 'FAIL');

  const saveProgress = await req('/api/reader/progress/1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: 12 }) });
  console.log('Save Progress:', saveProgress.status, saveProgress.data.saved ? 'saved' : 'FAIL');

  const login = await req('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
  console.log('Login:', login.status, login.data.success ? 'OK' : 'FAIL');

  const me = await req('/api/auth/check');
  console.log('Auth check:', me.status, me.data.isAdmin ? 'admin' : 'guest');

  const download = await req('/api/books/1/download');
  console.log('Download:', download.status, download.headers['content-type']?.includes('pdf') || download.status === 404 || download.status === 500 ? 'handled' : 'unexpected');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
