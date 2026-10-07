const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const items = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'gallery-items.json'), 'utf8'));

// 1. Generate templates/gallery.html
const galleryHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Championship Photo Gallery | Telangana Yoga Association</title>

    <!-- Favicon & Touch Icons -->
    <link rel="shortcut icon" href="/favicon.ico" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="icon" type="image/png" sizes="any" href="/static/images/favicon.png" />
    <link rel="apple-touch-icon" href="/static/images/apple-touch-icon.png" />

    <!-- Preload Critical Web Fonts -->
    <link rel="preload" href="/static/fonts/inter-variable.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/static/fonts/plus-jakarta-sans-variable.woff2" as="font" type="font/woff2" crossorigin />

    <!-- Google Fonts CDN Fallback & Preconnect -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Roboto:wght@400;500;700&display=swap" />

    <!-- Local Offline Assets -->
    <link rel="stylesheet" href="/static/vendor/fontawesome/css/all.min.css" />
    <link rel="stylesheet" href="/static/css/output.css" />
    <link rel="stylesheet" href="/static/css/custom.css" />
  </head>
  <body class="bg-slate-100 font-sans min-h-screen flex flex-col justify-between text-slate-800">
    <!-- A11y Skip Link -->
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <!-- Top Navigation Header -->
    <header class="bg-[#0D5C3A] text-white border-b-2 border-[#C5A059] py-3.5 px-4 sm:px-6 shadow-sm sticky top-0 z-40">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-white p-0.5 flex items-center justify-center border-2 border-[#C5A059] shadow-sm overflow-hidden flex-shrink-0">
            <img
              src="/static/images/TSYSC.png"
              width="52"
              height="52"
              decoding="async"
              class="w-full h-full object-contain rounded-full"
              alt="Telangana State Yoga Association Logo"
            />
          </div>
          <div>
            <span class="block font-bold text-xs sm:text-sm tracking-wider font-display uppercase leading-tight text-white">
              Telangana State Yoga Association
            </span>
            <p class="text-[11px] sm:text-xs text-amber-200 font-medium">
              13th State Inter-District Championship 2026
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <a
            href="/"
            class="inline-flex items-center gap-1.5 text-xs text-emerald-100 hover:text-white bg-white/10 hover:bg-white/20 px-3.5 py-1.5 rounded-full transition font-semibold"
          >
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
            <span>Back to Home</span>
          </a>
        </div>
      </div>
    </header>

    <!-- Main Content Container -->
    <main id="main-content" tabindex="-1" class="flex-grow py-10 px-4 sm:px-6 focus:outline-none">
      <div class="max-w-7xl mx-auto">
        <!-- Title & Header Banner -->
        <div class="text-center max-w-3xl mx-auto mb-8">
          <div class="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-3 py-1 rounded-full mb-3 shadow-xs">
            <i class="fa-solid fa-camera text-emerald-600" aria-hidden="true"></i>
            <span>Championship Photo Archive &bull; 46 Photographs</span>
          </div>
          <h1 class="text-2xl sm:text-4xl font-bold font-display text-slate-900 tracking-tight">
            Official Championship Photo Gallery
          </h1>
          <div class="w-16 h-1 bg-amber-500 rounded-full mx-auto my-3"></div>
          <p class="text-slate-600 text-xs sm:text-sm max-w-2xl mx-auto">
            Glimpses from the state tournament, including ceremonial lamp lighting, stage technical scrutiny, artistic routines, and podium medal presentations across Telangana districts.
          </p>
        </div>

        <!-- Category Filter Tabs -->
        <div class="flex flex-wrap items-center justify-center gap-2 mb-8">
          <button
            type="button"
            onclick="filterGallery('all', this)"
            class="gallery-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer bg-[#0D5C3A] text-white shadow-xs"
            data-cat="all"
          >
            All Photos (46)
          </button>
          <button
            type="button"
            onclick="filterGallery('ceremonies', this)"
            class="gallery-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            data-cat="ceremonies"
          >
            Inauguration &amp; Ceremonies
          </button>
          <button
            type="button"
            onclick="filterGallery('asanas', this)"
            class="gallery-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            data-cat="asanas"
          >
            Competition Asanas
          </button>
          <button
            type="button"
            onclick="filterGallery('artistic', this)"
            class="gallery-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            data-cat="artistic"
          >
            Artistic &amp; Rhythmic
          </button>
        </div>

        <!-- Clean Photo Grid (No zoom, No slideshow) -->
        <div
          id="gallery-grid"
          class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
        >
          <!-- Dynamic cards injected via script -->
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-slate-900 text-slate-400 py-6 px-4 text-center text-xs mt-12 border-t border-slate-800">
      <div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <p>&copy; 2026 Telangana State Yoga Association. Affiliated to Yoga Federation of India.</p>
        <a href="/" class="text-amber-400 hover:text-amber-300 font-semibold">Return to Main Portal &rarr;</a>
      </div>
    </footer>

    <script>
      (function () {
        const galleryItems = ${JSON.stringify(items, null, 2)};
        let currentCategory = 'all';
        const gridEl = document.getElementById('gallery-grid');

        function renderGrid() {
          if (!gridEl) return;
          gridEl.innerHTML = '';

          const filtered = currentCategory === 'all'
            ? galleryItems
            : galleryItems.filter(item => item.category === currentCategory);

          filtered.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-xl overflow-hidden border border-slate-200 shadow-xs flex flex-col';

            card.innerHTML = \`
              <div class="aspect-[4/3] w-full bg-slate-900 overflow-hidden relative">
                <img
                  src="\${item.thumb}"
                  alt="\${item.alt}"
                  width="600"
                  height="450"
                  loading="lazy"
                  decoding="async"
                  class="w-full h-full object-cover"
                />
                <span class="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  \${item.categoryLabel}
                </span>
              </div>
              <div class="p-3 bg-white flex flex-col flex-grow justify-between">
                <h2 class="text-xs font-bold text-slate-800 line-clamp-2">
                  \${item.title}
                </h2>
                <p class="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  \${item.desc || item.title}
                </p>
              </div>
            \`;

            gridEl.appendChild(card);
          });
        }

        window.filterGallery = function (cat, btnEl) {
          currentCategory = cat;
          document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
            if (btn.getAttribute('data-cat') === cat) {
              btn.className = 'gallery-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer bg-[#0D5C3A] text-white shadow-xs';
            } else {
              btn.className = 'gallery-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer bg-white text-slate-700 hover:bg-slate-50 border border-slate-200';
            }
          });
          renderGrid();
        };

        renderGrid();
      })();
    </script>
  </body>
</html>
`;

fs.writeFileSync(path.join(root, 'templates', 'gallery.html'), galleryHtml, 'utf8');
console.log('Successfully created templates/gallery.html');

// 2. Update templates/index.html to show only a small curated preview of recent images (dont show all pictures, no slideshow, no zoom)
const featuredItems = items.slice(0, 6);

let featuredCardsHtml = '';
featuredItems.forEach((item) => {
  featuredCardsHtml += `
            <!-- Gallery Card -->
            <div class="card overflow-hidden bg-white border border-slate-200 rounded-xl shadow-xs">
              <div class="aspect-[4/3] w-full overflow-hidden bg-slate-900 relative">
                <img
                  src="${item.thumb}"
                  alt="${item.alt}"
                  width="600"
                  height="450"
                  decoding="async"
                  loading="lazy"
                  class="w-full h-full object-cover"
                />
                <span class="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  ${item.categoryLabel}
                </span>
              </div>
              <div class="p-3 text-[11px] sm:text-xs font-semibold text-slate-800 line-clamp-1">
                ${item.title}
              </div>
            </div>`;
});

const indexGallerySection = `      <!-- SECTION 3.5: PHOTO GALLERY -->
      <section id="gallery" class="py-16 bg-slate-100/70 scroll-mt-20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6">
          <div class="text-center max-w-3xl mx-auto mb-10">
            <span class="section-badge">Championship Moments</span>
            <h2 class="text-3xl font-bold font-display text-slate-900">
              Photo Gallery
            </h2>
            <div class="section-divider mx-auto"></div>
            <p class="text-slate-600 text-sm sm:text-base">
              Recent glimpses from District Selection Trials, State Championship rounds, and felicitation ceremonies across Telangana.
            </p>
          </div>

          <!-- Curated Preview Grid (6 Recent Photos, No Zoom, No Slideshow) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
${featuredCardsHtml}
          </div>

          <!-- Link to Dedicated Full Gallery Page -->
          <div class="mt-10 text-center">
            <a
              href="/gallery"
              class="inline-flex items-center gap-2 bg-[#0D5C3A] text-white hover:bg-[#0a4229] px-7 py-3 rounded-full text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <i class="fa-solid fa-images" aria-hidden="true"></i>
              <span>View Full Gallery (46 Photos)</span>
              <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
            </a>
          </div>
        </div>
      </section>`;

let indexContent = fs.readFileSync(path.join(root, 'templates', 'index.html'), 'utf8');

// Update Hero Button
indexContent = indexContent.replace(
  /<a\s+href="[^"]*"\s+(?:onclick="[^"]*"\s+)?class="btn-primary">(\s*<i\s+class="fa-solid\s+fa-images"[^>]*><\/i>\s*<span>View Gallery<\/span>)/g,
  '<a href="/gallery" class="btn-primary">$1'
);

// Replace Section 3.5
const startTag = '<!-- SECTION 3.5: PHOTO GALLERY -->';
const endTag = '<!-- SECTION 4: 33 DISTRICTS OF TELANGANA -->';

const startIndex = indexContent.indexOf(startTag);
const endIndex = indexContent.indexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
  indexContent = indexContent.substring(0, startIndex) + indexGallerySection + '\n\n      ' + indexContent.substring(endIndex);
  fs.writeFileSync(path.join(root, 'templates', 'index.html'), indexContent, 'utf8');
  console.log('Successfully updated templates/index.html with curated 6-card preview and link to /gallery.');
} else {
  console.error('Could not find gallery section tags in templates/index.html');
}
