const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'templates', 'index.html');
const itemsJsonPath = path.join(root, 'scripts', 'gallery-items.json');

const items = JSON.parse(fs.readFileSync(itemsJsonPath, 'utf8'));

// Generate the Gallery Section HTML and JS
const galleryHtml = `      <!-- SECTION 3.5: PHOTO GALLERY -->
      <section id="gallery" class="py-16 bg-slate-100/70 scroll-mt-20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6">
          <div class="text-center max-w-3xl mx-auto mb-8">
            <span class="section-badge">Championship Moments</span>
            <h2 class="text-3xl font-bold font-display text-slate-900">
              Photo Gallery
            </h2>
            <div class="section-divider mx-auto"></div>
            <p class="text-slate-600 text-sm sm:text-base">
              Glimpses from the Telangana State Inter-District Yogasana Sports Championship, including ceremonial inaugurations, technical scrutiny rounds, artistic formations, and medal ceremonies.
            </p>
            <div class="mt-3 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-3 py-1 rounded-full shadow-xs">
              <i class="fa-solid fa-camera text-emerald-600" aria-hidden="true"></i>
              <span id="gallery-count-badge">46 Official Championship Photographs</span>
            </div>
          </div>

          <!-- Category Filter Tabs -->
          <div class="flex flex-wrap items-center justify-center gap-2 mb-8">
            <button
              type="button"
              onclick="filterGallery('all', this)"
              class="gallery-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer bg-[#0D5C3A] text-white shadow-xs"
              data-cat="all"
            >
              All Photos (46)
            </button>
            <button
              type="button"
              onclick="filterGallery('ceremonies', this)"
              class="gallery-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
              data-cat="ceremonies"
            >
              Inauguration &amp; Ceremonies
            </button>
            <button
              type="button"
              onclick="filterGallery('asanas', this)"
              class="gallery-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
              data-cat="asanas"
            >
              Competition Asanas
            </button>
            <button
              type="button"
              onclick="filterGallery('artistic', this)"
              class="gallery-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
              data-cat="artistic"
            >
              Artistic &amp; Rhythmic
            </button>
          </div>

          <!-- Dynamic Gallery Cards Grid -->
          <div
            id="gallery-grid"
            class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5"
          >
            <!-- Dynamic Cards injected via script -->
          </div>

          <!-- Action Buttons Bar -->
          <div class="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              id="gallery-toggle-btn"
              onclick="toggleGalleryView()"
              class="inline-flex items-center gap-2 bg-[#0D5C3A] text-white hover:bg-[#0a4229] px-7 py-3 rounded-full text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
            >
              <i class="fa-solid fa-images" aria-hidden="true"></i>
              <span id="gallery-toggle-btn-text">View Full Gallery (46 Photos)</span>
              <i id="gallery-toggle-btn-icon" class="fa-solid fa-chevron-down text-xs transition-transform" aria-hidden="true"></i>
            </button>

            <button
              type="button"
              onclick="openGalleryModal(0)"
              class="inline-flex items-center gap-2 bg-white text-slate-800 hover:bg-slate-50 border border-slate-300 px-6 py-3 rounded-full text-xs sm:text-sm font-bold shadow-xs hover:shadow transition focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <i class="fa-solid fa-play text-emerald-600" aria-hidden="true"></i>
              <span>Fullscreen Slideshow</span>
            </button>
          </div>

          <!-- Interactive Lightbox Modal -->
          <div
            id="gallery-modal"
            class="fixed inset-0 z-50 hidden bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-2 sm:p-5 select-none"
            role="dialog"
            aria-modal="true"
            aria-label="Photo Gallery Lightbox"
          >
            <!-- Modal Top Bar -->
            <div class="w-full max-w-6xl flex items-center justify-between text-white/90 py-2 px-2 z-10 shrink-0">
              <div class="flex items-center gap-2 truncate">
                <span id="gallery-modal-tag" class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white shrink-0">Championship</span>
                <span id="gallery-modal-title" class="text-xs sm:text-sm font-semibold truncate text-white"></span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <a
                  id="gallery-modal-hd"
                  href="#"
                  target="_blank"
                  download
                  class="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition focus:outline-none focus:ring-2 focus:ring-amber-400"
                  title="View Original High-Resolution Photo"
                >
                  <i class="fa-solid fa-expand text-[10px]" aria-hidden="true"></i>
                  <span class="hidden sm:inline">View HD</span>
                </a>
                <button
                  type="button"
                  id="gallery-modal-close"
                  aria-label="Close image preview"
                  class="text-white/80 hover:text-white text-xl w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                >
                  <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
              </div>
            </div>

            <!-- Modal Image Stage with Arrows -->
            <div class="relative w-full max-w-6xl flex-1 flex items-center justify-center overflow-hidden min-h-0 my-auto">
              <img
                id="gallery-modal-img"
                src=""
                alt="Championship gallery photo"
                class="max-h-[68vh] sm:max-h-[72vh] w-auto max-w-full object-contain rounded-lg shadow-2xl transition-opacity duration-200"
              />

              <!-- Nav Prev -->
              <button
                type="button"
                id="gallery-modal-prev"
                aria-label="Previous photo"
                class="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white w-10 sm:w-12 h-10 sm:h-12 rounded-full flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-lg"
              >
                <i class="fa-solid fa-chevron-left text-sm sm:text-base" aria-hidden="true"></i>
              </button>

              <!-- Nav Next -->
              <button
                type="button"
                id="gallery-modal-next"
                aria-label="Next photo"
                class="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white w-10 sm:w-12 h-10 sm:h-12 rounded-full flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-lg"
              >
                <i class="fa-solid fa-chevron-right text-sm sm:text-base" aria-hidden="true"></i>
              </button>
            </div>

            <!-- Modal Footer & Thumbnails Carousel -->
            <div class="w-full max-w-6xl flex flex-col gap-2 pt-2 pb-1 z-10 shrink-0">
              <div class="flex items-center justify-between text-white/80 px-2 text-xs">
                <span id="gallery-modal-caption" class="text-white/70 truncate pr-3"></span>
                <span id="gallery-modal-counter" class="text-amber-400 font-mono font-bold shrink-0 text-xs"></span>
              </div>

              <!-- Horizontal Thumbnails Strip -->
              <div
                id="gallery-modal-thumbs"
                class="flex items-center gap-2 overflow-x-auto py-1 px-1 scrollbar-thin scrollbar-thumb-white/20"
                style="scrollbar-width: thin; -webkit-overflow-scrolling: touch;"
              >
                <!-- Mini thumbnails rendered by script -->
              </div>
            </div>
          </div>

          <script>
            (function () {
              const galleryItems = ${JSON.stringify(items, null, 2)};

              const INITIAL_COUNT = 8;
              let isExpanded = false;
              let currentCategory = 'all';
              let activeFilteredItems = [...galleryItems];
              let currentIndex = 0;

              const gridEl = document.getElementById('gallery-grid');
              const toggleBtn = document.getElementById('gallery-toggle-btn');
              const toggleBtnText = document.getElementById('gallery-toggle-btn-text');
              const toggleBtnIcon = document.getElementById('gallery-toggle-btn-icon');
              const countBadge = document.getElementById('gallery-count-badge');

              const modal = document.getElementById('gallery-modal');
              const modalImg = document.getElementById('gallery-modal-img');
              const modalTitle = document.getElementById('gallery-modal-title');
              const modalTag = document.getElementById('gallery-modal-tag');
              const modalCaption = document.getElementById('gallery-modal-caption');
              const modalCounter = document.getElementById('gallery-modal-counter');
              const modalHd = document.getElementById('gallery-modal-hd');
              const modalThumbs = document.getElementById('gallery-modal-thumbs');
              const prevBtn = document.getElementById('gallery-modal-prev');
              const nextBtn = document.getElementById('gallery-modal-next');
              const closeBtn = document.getElementById('gallery-modal-close');

              function renderGrid() {
                if (!gridEl) return;
                gridEl.innerHTML = '';

                const itemsToShow = isExpanded
                  ? activeFilteredItems
                  : activeFilteredItems.slice(0, INITIAL_COUNT);

                itemsToShow.forEach((item, index) => {
                  const globalIdx = galleryItems.indexOf(item);
                  const card = document.createElement('div');
                  card.className = 'card overflow-hidden group cursor-pointer bg-white flex flex-col justify-between border border-slate-200/80 hover:border-emerald-500/50 hover:shadow-md transition duration-300';
                  card.setAttribute('role', 'button');
                  card.setAttribute('tabindex', '0');
                  card.setAttribute('aria-label', 'View photo: ' + item.title);
                  card.onclick = () => window.openGalleryModal(globalIdx);
                  card.onkeydown = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      window.openGalleryModal(globalIdx);
                    }
                  };

                  card.innerHTML = \`
                    <div class="aspect-[4/3] w-full overflow-hidden bg-slate-900 flex items-center justify-center relative">
                      <img
                        src="\${item.thumb}"
                        alt="\${item.alt}"
                        width="600"
                        height="450"
                        decoding="async"
                        loading="lazy"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                      />
                      <div class="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span class="bg-black/70 text-white rounded-full p-2.5 text-xs shadow">
                          <i class="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i>
                        </span>
                      </div>
                      <span class="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        \${item.categoryLabel}
                      </span>
                    </div>
                    <div class="p-2.5 text-left bg-white">
                      <p class="text-[11px] sm:text-xs font-semibold text-slate-800 line-clamp-1 group-hover:text-emerald-700 transition-colors">
                        \${item.title}
                      </p>
                    </div>
                  \`;

                  gridEl.appendChild(card);
                });

                if (toggleBtn) {
                  if (activeFilteredItems.length <= INITIAL_COUNT) {
                    toggleBtn.classList.add('hidden');
                  } else {
                    toggleBtn.classList.remove('hidden');
                    if (isExpanded) {
                      toggleBtnText.textContent = 'Show Fewer Photos';
                      toggleBtnIcon.className = 'fa-solid fa-chevron-up text-xs transition-transform';
                    } else {
                      toggleBtnText.textContent = 'View Full Gallery (' + activeFilteredItems.length + ' Photos)';
                      toggleBtnIcon.className = 'fa-solid fa-chevron-down text-xs transition-transform';
                    }
                  }
                }
              }

              window.toggleGalleryView = function () {
                isExpanded = !isExpanded;
                renderGrid();
                if (!isExpanded) {
                  const gallerySec = document.getElementById('gallery');
                  if (gallerySec) {
                    gallerySec.scrollIntoView({ behavior: 'smooth' });
                  }
                }
              };

              window.viewAllGalleryImages = function () {
                currentCategory = 'all';
                activeFilteredItems = [...galleryItems];
                isExpanded = true;
                updateFilterButtons();
                renderGrid();
              };

              function updateFilterButtons() {
                document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
                  const cat = btn.getAttribute('data-cat');
                  if (cat === currentCategory) {
                    btn.className = 'gallery-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer bg-[#0D5C3A] text-white shadow-xs';
                  } else {
                    btn.className = 'gallery-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer bg-white text-slate-700 hover:bg-slate-50 border border-slate-200';
                  }
                });
              }

              window.filterGallery = function (cat, btnEl) {
                currentCategory = cat;
                if (cat === 'all') {
                  activeFilteredItems = [...galleryItems];
                } else {
                  activeFilteredItems = galleryItems.filter(item => item.category === cat);
                }
                updateFilterButtons();
                renderGrid();
              };

              function buildModalThumbs() {
                if (!modalThumbs) return;
                modalThumbs.innerHTML = '';
                galleryItems.forEach((item, idx) => {
                  const thumbBtn = document.createElement('button');
                  thumbBtn.type = 'button';
                  thumbBtn.className = 'shrink-0 w-12 h-9 rounded overflow-hidden border-2 transition-all cursor-pointer opacity-60 hover:opacity-100 focus:outline-none ' +
                    (idx === currentIndex ? 'border-amber-400 opacity-100 scale-105' : 'border-transparent');
                  thumbBtn.setAttribute('aria-label', 'Jump to photo ' + (idx + 1));
                  const thumbImg = document.createElement('img');
                  thumbImg.src = item.thumb;
                  thumbImg.alt = 'Championship gallery thumbnail ' + (idx + 1);
                  thumbImg.className = 'w-full h-full object-cover';
                  thumbBtn.appendChild(thumbImg);
                  modalThumbs.appendChild(thumbBtn);
                });
              }

              function showImage(index) {
                if (index < 0) index = galleryItems.length - 1;
                if (index >= galleryItems.length) index = 0;
                currentIndex = index;

                const item = galleryItems[currentIndex];
                if (modalImg) {
                  modalImg.style.opacity = '0';
                  setTimeout(() => {
                    modalImg.src = item.src;
                    modalImg.alt = item.alt;
                    modalImg.style.opacity = '1';
                  }, 50);
                }
                if (modalTitle) modalTitle.textContent = item.title;
                if (modalTag) modalTag.textContent = item.categoryLabel;
                if (modalCaption) modalCaption.textContent = item.desc || item.title;
                if (modalCounter) modalCounter.textContent = (currentIndex + 1) + ' / ' + galleryItems.length;
                if (modalHd) modalHd.href = item.hd;

                // Update active thumbnail in strip
                if (modalThumbs) {
                  const thumbBtns = modalThumbs.children;
                  for (let i = 0; i < thumbBtns.length; i++) {
                    if (i === currentIndex) {
                      thumbBtns[i].className = 'shrink-0 w-12 h-9 rounded overflow-hidden border-2 border-amber-400 opacity-100 scale-105 transition-all cursor-pointer';
                      thumbBtns[i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    } else {
                      thumbBtns[i].className = 'shrink-0 w-12 h-9 rounded overflow-hidden border-2 border-transparent opacity-60 hover:opacity-100 transition-all cursor-pointer';
                    }
                  }
                }
              }

              window.openGalleryModal = function (index) {
                if (!modalThumbs || modalThumbs.children.length === 0) {
                  buildModalThumbs();
                }
                showImage(index);
                if (modal) {
                  modal.classList.remove('hidden');
                  document.body.style.overflow = 'hidden';
                }
              };

              function closeGalleryModal() {
                if (modal) {
                  modal.classList.add('hidden');
                  document.body.style.overflow = '';
                }
              }

              if (closeBtn) closeBtn.addEventListener('click', closeGalleryModal);
              if (prevBtn) prevBtn.addEventListener('click', () => showImage(currentIndex - 1));
              if (nextBtn) nextBtn.addEventListener('click', () => showImage(currentIndex + 1));

              if (modal) {
                modal.addEventListener('click', (e) => {
                  if (e.target === modal) closeGalleryModal();
                });
              }

              document.addEventListener('keydown', (e) => {
                if (!modal || modal.classList.contains('hidden')) return;
                if (e.key === 'Escape') closeGalleryModal();
                else if (e.key === 'ArrowLeft') showImage(currentIndex - 1);
                else if (e.key === 'ArrowRight') showImage(currentIndex + 1);
              });

              // Touch swipe support for mobile
              let touchStartX = 0;
              let touchEndX = 0;
              if (modal) {
                modal.addEventListener('touchstart', (e) => {
                  touchStartX = e.changedTouches[0].screenX;
                }, { passive: true });

                modal.addEventListener('touchend', (e) => {
                  touchEndX = e.changedTouches[0].screenX;
                  const diff = touchEndX - touchStartX;
                  if (Math.abs(diff) > 40) {
                    if (diff < 0) showImage(currentIndex + 1); // Swipe left -> Next
                    else showImage(currentIndex - 1); // Swipe right -> Prev
                  }
                }, { passive: true });
              }

              // Initial grid render
              renderGrid();
            })();
          </script>
        </div>
      </section>`;

// Replace section in index.html
let indexContent = fs.readFileSync(indexPath, 'utf8');

// Also update hero button onclick if present
const heroGalleryRegex = /(<a\s+href="#gallery"\s+class="btn-primary">)/;
if (heroGalleryRegex.test(indexContent)) {
  indexContent = indexContent.replace(
    heroGalleryRegex,
    '<a href="#gallery" onclick="if(window.viewAllGalleryImages)window.viewAllGalleryImages()" class="btn-primary">'
  );
  console.log('Updated hero "View Gallery" button.');
}

// Find gallery section range
const startTag = '<!-- SECTION 3.5: PHOTO GALLERY -->';
const endTag = '<!-- SECTION 4: 33 DISTRICTS OF TELANGANA -->';

const startIndex = indexContent.indexOf(startTag);
const endIndex = indexContent.indexOf(endTag);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not locate gallery section boundaries in index.html');
  process.exit(1);
}

const newIndexContent = indexContent.substring(0, startIndex) + galleryHtml + '\n\n      ' + indexContent.substring(endIndex);
fs.writeFileSync(indexPath, newIndexContent, 'utf8');
console.log('Successfully updated templates/index.html with full dynamic 46-photo gallery!');
