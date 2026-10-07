const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const galleryDir = path.join(root, 'static', 'images', 'gallery');

// Metadata map for rich titles, categories, and descriptive alt texts
const metadataMap = {
  'DSC_8586.jpg': {
    title: 'Lamp Lighting (Jyothi Prajwalana) • Auspicious Inauguration',
    cat: 'ceremonies',
    catLabel: 'Ceremonies',
    alt: 'Dignitaries lighting the ceremonial lamp (Jyothi Prajwalana) to inaugurate the 13th Telangana State Yogasana Championship'
  },
  'DSC_8583.jpg': {
    title: 'Championship Inaugural Stage • Official Assembly',
    cat: 'ceremonies',
    catLabel: 'Ceremonies',
    alt: 'Officials and dignitaries assembled on stage for the championship inaugural ceremony'
  },
  'DSC_8592.jpg': {
    title: 'Welcome Address & Stage Gathering',
    cat: 'ceremonies',
    catLabel: 'Ceremonies',
    alt: 'Welcome address on stage before athletes and district contingents'
  },
  'DSC_8602.jpg': {
    title: 'Technical Scrutiny & Judging Panel',
    cat: 'ceremonies',
    catLabel: 'Officials',
    alt: 'Referees, judges, and technical scrutiny panel at the championship dais'
  },
  'DSC_8604.jpg': {
    title: 'Chief Guest Address to Competitors',
    cat: 'ceremonies',
    catLabel: 'Ceremonies',
    alt: 'Chief guest delivering inspirational opening address to participants'
  },
  'DSC_8605.jpg': {
    title: 'Association Executive Committee on Dais',
    cat: 'ceremonies',
    catLabel: 'Officials',
    alt: 'Telangana Yoga Association executive committee members assembled on stage'
  },
  'DSC_8617.jpg': {
    title: 'Memento Presentation to Association Patrons',
    cat: 'ceremonies',
    catLabel: 'Ceremonies',
    alt: 'Presenting honorary mementos and traditional shawls to championship patrons'
  },
  'DSC_8619.jpg': {
    title: 'Dignitary Felicitation & Honors',
    cat: 'ceremonies',
    catLabel: 'Ceremonies',
    alt: 'Honoring key contributors and patrons of yoga sports in Telangana'
  },
  'DSC_8631.jpg': {
    title: 'Championship Keynote & Athlete Briefing',
    cat: 'ceremonies',
    catLabel: 'Ceremonies',
    alt: 'Keynote address outlining national championship pathway and sporting ethics'
  },
  'DSC_8646.jpg': {
    title: 'Honorary Memento Distribution',
    cat: 'ceremonies',
    catLabel: 'Ceremonies',
    alt: 'Felicitation of special guests supporting the state inter-district championship'
  },
  'DSC_8664.jpg': {
    title: 'Inauguration Dignitaries Stage Assembly',
    cat: 'ceremonies',
    catLabel: 'Officials',
    alt: 'Executive committee and chief guests assembling on the championship stage'
  },
  'DSC_8730.jpg': {
    title: 'State Championship Arena • Competition Stage',
    cat: 'asanas',
    catLabel: 'Competition',
    alt: 'State Championship competition arena with official judging table and athletes'
  },
  'DSC_8734.jpg': {
    title: 'Jury Panel in Scrutiny Session',
    cat: 'asanas',
    catLabel: 'Competition',
    alt: 'Official jury panel evaluating form, balance, and breathing precision'
  },
  'DSC_8740.jpg': {
    title: 'Traditional Yogasana Stage Demonstration',
    cat: 'asanas',
    catLabel: 'Asanas',
    alt: 'Athlete performing traditional posture with strict technical adherence'
  },
  'DSC_8752.jpg': {
    title: 'Competition Stage • Technical Scrutiny',
    cat: 'asanas',
    catLabel: 'Competition',
    alt: 'Jury scorekeeping and timekeeping during competitive asana holds'
  },
  'DSC_8767.jpg': {
    title: 'Precision Standing Balance • Championship Round',
    cat: 'asanas',
    catLabel: 'Asanas',
    alt: 'Athlete performing high-precision standing balance posture during state selection trials'
  },
  'DSC_8769.jpg': {
    title: 'Advanced Flexibility Asana Execution',
    cat: 'asanas',
    catLabel: 'Asanas',
    alt: 'Junior athlete holding deep flexibility posture before the judge panel'
  },
  'DSC_8771.jpg': {
    title: 'Sub-Junior Division Competitive Round',
    cat: 'asanas',
    catLabel: 'Asanas',
    alt: 'Young athlete demonstrating intense focus and limb alignment on stage'
  },
  'DSC_8777.jpg': {
    title: 'Junior Championship Asana Performance',
    cat: 'asanas',
    catLabel: 'Asanas',
    alt: 'Contestant executing textbook precision during compulsory asana set'
  },
  'DSC_8782.jpg': {
    title: 'Backward Bending & Core Balance Hold',
    cat: 'asanas',
    catLabel: 'Asanas',
    alt: 'Championship competitor demonstrating core strength and spinal mobility'
  },
  'DSC_8822.jpg': {
    title: 'Arm Balance & Inversion Precision',
    cat: 'asanas',
    catLabel: 'Asanas',
    alt: 'Athlete executing advanced arm balance with steady concentration'
  },
  'DSC_8824.jpg': {
    title: 'Traditional Asana Routine • Stage Heats',
    cat: 'asanas',
    catLabel: 'Asanas',
    alt: 'Demonstrating traditional yogasana sequences according to NYSF standards'
  },
  'DSC_8857.jpg': {
    title: 'Competitive Floor Asana Execution',
    cat: 'asanas',
    catLabel: 'Asanas',
    alt: 'Participant holding seated twisting and hip-opener postures'
  },
  'DSC_8859.jpg': {
    title: 'Competition Arena • District Athletes',
    cat: 'asanas',
    catLabel: 'Competition',
    alt: 'Athletes from Telangana districts competing in synchronized heats'
  },
  'DSC_8867.jpg': {
    title: 'Precision Asana Alignment Round',
    cat: 'asanas',
    catLabel: 'Asanas',
    alt: 'Scored demonstration of posture holding duration and breath control'
  },
  'DSC_8871.jpg': {
    title: 'Advanced Asana Mastery • Senior Division',
    cat: 'asanas',
    catLabel: 'Asanas',
    alt: 'Senior division athlete presenting flawless posture stability'
  },
  'DSC_8934.jpg': {
    title: 'Artistic Group Pyramid • Synchronized Formation',
    cat: 'artistic',
    catLabel: 'Artistic',
    alt: 'Synchronized artistic yogasana multi-tier pyramid formation on stage'
  },
  'DSC_8951.jpg': {
    title: 'Artistic Yogasana Demonstration',
    cat: 'artistic',
    catLabel: 'Artistic',
    alt: 'Flowing artistic movements combining traditional yogic postures and music'
  },
  'DSC_8956.jpg': {
    title: 'Artistic Yogasana Routine • Dynamic Split Holds',
    cat: 'artistic',
    catLabel: 'Artistic',
    alt: 'Dynamic standing split and balance holds in artistic yogasana competitive category'
  },
  'DSC_8957.jpg': {
    title: 'Team Choreography & Graceful Holds',
    cat: 'artistic',
    catLabel: 'Artistic',
    alt: 'Rhythmic yogasana routine exhibiting team harmony and flexibility'
  },
  'DSC_8990.jpg': {
    title: 'Acrobatic & Group Balance Feat',
    cat: 'artistic',
    catLabel: 'Artistic',
    alt: 'Spectacular multi-tier standing split and artistic formation on stage'
  },
  'DSC_9162.jpg': {
    title: 'Medal Distribution • State Champions',
    cat: 'ceremonies',
    catLabel: 'Awards',
    alt: 'Awarding gold, silver, and bronze championship medals to winners'
  },
  'DSC_9320.jpg': {
    title: 'Victory Podium • Gold Medalist Honors',
    cat: 'ceremonies',
    catLabel: 'Awards',
    alt: 'Gold medalist athletes on the podium receiving state ranking awards and honors'
  },
  'DSC_9352.jpg': {
    title: 'Merit Certificates & Trophies Presentation',
    cat: 'ceremonies',
    catLabel: 'Awards',
    alt: 'Dignitaries presenting state ranking trophies to district winners'
  },
  'DSC_9383.jpg': {
    title: 'Championship Trophy Felicitation',
    cat: 'ceremonies',
    catLabel: 'Awards',
    alt: 'Team championship trophy presentation to overall district winners'
  },
  'DSC_9388.jpg': {
    title: 'District Contingent Felicitation',
    cat: 'ceremonies',
    catLabel: 'Awards',
    alt: 'Honoring top district delegations and team managers on stage'
  },
  'DSC_9401.jpg': {
    title: 'Merit Honors on Championship Dais',
    cat: 'ceremonies',
    catLabel: 'Awards',
    alt: 'Awarding certificates and medals to sub-junior and junior champions'
  },
  'DSC_9403.jpg': {
    title: 'State Winners with Association Officials',
    cat: 'ceremonies',
    catLabel: 'Awards',
    alt: 'Proud medallists posed with association leaders and tournament patrons'
  },
  'DSC_9427.jpg': {
    title: 'Grand Assembly of Winners & Officials',
    cat: 'ceremonies',
    catLabel: 'Officials',
    alt: 'Celebratory stage assembly of medal winners and organizers'
  },
  'DSC_9466.jpg': {
    title: 'Grand Closing Ceremony & Valedictory Assembly',
    cat: 'ceremonies',
    catLabel: 'Ceremonies',
    alt: 'Closing valedictory ceremony and assembly celebrating Telangana state yoga athletes'
  },
  'gallery-01.jpg': {
    title: 'Inaugural Address • 13th State Championship',
    cat: 'ceremonies',
    catLabel: 'Ceremonies',
    alt: 'Dignitaries inaugural address on stage at 13th State Level Yogasana Sports Championship 2026'
  },
  'gallery-02.jpg': {
    title: 'Jyothi Prajwalana • Ceremonial Inauguration',
    cat: 'ceremonies',
    catLabel: 'Ceremonies',
    alt: 'Dignitaries lighting the ceremonial lamp (Jyothi Prajwalana) before Goddess Saraswati'
  },
  'gallery-03.jpg': {
    title: 'Artistic Group Formation • Girls Championship Round',
    cat: 'artistic',
    catLabel: 'Artistic',
    alt: 'Young athletes performing synchronized artistic yogasana pyramid formation on stage'
  },
  'gallery-04.jpg': {
    title: 'Association Dignitaries • Inaugural Assembly',
    cat: 'ceremonies',
    catLabel: 'Officials',
    alt: 'Telangana Yoga Association officials and dignitaries group photo at championship venue'
  },
  'gallery-05.jpg': {
    title: 'Artistic Group Formation • Boys Demonstration',
    cat: 'artistic',
    catLabel: 'Artistic',
    alt: 'Young boys team performing multi-tier standing split and balance yogasana formation'
  },
  'gallery-06.jpg': {
    title: 'Artistic Solo Performance • Standing Vertical Split',
    cat: 'artistic',
    catLabel: 'Artistic',
    alt: 'Solo yogasana athlete performing standing vertical split (Trivikramasana) on stage'
  }
};

// Scan files directly from static/images/gallery
const rawFiles = fs.readdirSync(galleryDir).filter((f) => f.match(/\.(jpe?g|png|webp)$/i));
rawFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
console.log(`Found ${rawFiles.length} images directly in static/images/gallery.`);

// Build gallery cards directly into the HTML with strict vertical and horizontal alignment
let cardsHtml = '';
rawFiles.forEach((file, index) => {
  const meta = metadataMap[file] || {
    title: file.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
    cat: 'ceremonies',
    catLabel: 'Championship',
    alt: `Telangana State Yogasana Championship photograph ${file}`
  };

  cardsHtml += `
          <!-- Photo Card ${index + 1}: ${file} -->
          <div class="gallery-card bg-white rounded-xl overflow-hidden border border-slate-200 shadow-xs flex flex-col h-full" data-cat="${meta.cat}">
            <div class="gallery-img-wrap relative w-full bg-slate-950 overflow-hidden flex items-center justify-center flex-shrink-0">
              <img
                src="/static/images/gallery/${file}"
                alt="${meta.alt}"
                width="600"
                height="450"
                loading="lazy"
                decoding="async"
                class="w-full h-full object-cover"
              />
              <span class="gallery-card-badge absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-xs">
                ${meta.catLabel}
              </span>
            </div>
            <div class="gallery-card-body p-3.5 bg-white flex flex-col flex-1 justify-between">
              <div>
                <h2 class="gallery-card-title text-xs font-bold text-slate-800 leading-snug line-clamp-2">
                  ${meta.title}
                </h2>
                <p class="gallery-card-desc text-[11px] text-slate-500 mt-1 leading-normal line-clamp-2">
                  ${meta.alt}
                </p>
              </div>
              <div class="gallery-card-footer mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                <span class="font-semibold text-emerald-700">Photo #${index + 1}</span>
                <span class="font-mono text-slate-400">${file}</span>
              </div>
            </div>
          </div>`;
});

// Complete templates/gallery.html
const galleryPageHtml = `<!doctype html>
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

    <style>
      /* Strict Grid & Alignment Rules for All Gallery Images */
      #gallery-grid {
        display: grid;
        grid-template-columns: repeat(1, minmax(0, 1fr));
        gap: 1.25rem;
        align-items: stretch;
      }
      @media (min-width: 640px) {
        #gallery-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.5rem;
        }
      }
      @media (min-width: 1024px) {
        #gallery-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1.5rem;
        }
      }
      @media (min-width: 1280px) {
        #gallery-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1.5rem;
        }
      }

      /* Uniform Card Box */
      .gallery-card {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        overflow: hidden;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
        transition: box-shadow 0.2s ease;
      }
      .gallery-card:hover {
        box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.08);
      }
      .gallery-card[style*="display: none"] {
        display: none !important;
      }

      /* Fixed 3:2 Aspect Ratio Frame for Perfect Alignment Across All Images */
      .gallery-img-wrap {
        position: relative;
        width: 100%;
        aspect-ratio: 3 / 2;
        min-height: 180px;
        background-color: #0f172a;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      @supports (aspect-ratio: 3 / 2) {
        .gallery-img-wrap {
          min-height: unset;
          aspect-ratio: 3 / 2;
        }
      }
      .gallery-img-wrap img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 25%;
        display: block;
        transform: none !important;
        transition: none !important;
      }

      /* Uniform Card Body & Text Alignment Across Columns */
      .gallery-card-body {
        padding: 0.875rem;
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        justify-content: space-between;
        background-color: #ffffff;
      }
      .gallery-card-title {
        font-size: 0.75rem;
        font-weight: 700;
        color: #1e293b;
        line-height: 1.35;
        min-height: 2.1rem;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .gallery-card-desc {
        font-size: 0.6875rem;
        color: #64748b;
        line-height: 1.4;
        margin-top: 0.25rem;
        min-height: 1.95rem;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .gallery-card-footer {
        margin-top: 0.75rem;
        padding-top: 0.5rem;
        border-top: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.625rem;
      }
    </style>
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
            <span>Official Photo Archive &bull; ${rawFiles.length} Photographs</span>
          </div>
          <h1 class="text-2xl sm:text-4xl font-bold font-display text-slate-900 tracking-tight">
            Championship Photo Gallery
          </h1>
          <div class="w-16 h-1 bg-amber-500 rounded-full mx-auto my-3"></div>
          <p class="text-slate-600 text-xs sm:text-sm max-w-2xl mx-auto">
            All official photographs from the folder <code>/static/images/gallery</code> showcasing the 13th Telangana State Yogasana Sports Championship.
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
            All Photos (${rawFiles.length})
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

        <!-- Clean Static Photo Grid (All Images Aligned, No Zoom, No Slideshow) -->
        <div
          id="gallery-grid"
        >
${cardsHtml}
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
      function filterGallery(category, btnEl) {
        const cards = document.querySelectorAll('.gallery-card');
        cards.forEach((card) => {
          if (category === 'all' || card.getAttribute('data-cat') === category) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });

        document.querySelectorAll('.gallery-filter-btn').forEach((btn) => {
          if (btn === btnEl) {
            btn.className = 'gallery-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer bg-[#0D5C3A] text-white shadow-xs';
          } else {
            btn.className = 'gallery-filter-btn px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer bg-white text-slate-700 hover:bg-slate-50 border border-slate-200';
          }
        });
      }
    </script>
  </body>
</html>
`;

fs.writeFileSync(path.join(root, 'templates', 'gallery.html'), galleryPageHtml, 'utf8');
console.log('Successfully wrote templates/gallery.html containing all images directly in HTML!');

// Also ensure templates/index.html uses direct path /static/images/gallery/<file> for its 6 cards with identical aligned layout
const featuredFiles = ['DSC_8586.jpg', 'DSC_8583.jpg', 'DSC_8730.jpg', 'DSC_8934.jpg', 'DSC_8767.jpg', 'DSC_9320.jpg'];

let featuredCardsHtml = '';
featuredFiles.forEach((file) => {
  const meta = metadataMap[file] || { title: file, catLabel: 'Championship', alt: file };
  featuredCardsHtml += `
            <!-- Gallery Card: ${file} -->
            <div class="gallery-card bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col h-full">
              <div class="gallery-img-wrap relative w-full bg-slate-950 overflow-hidden flex items-center justify-center flex-shrink-0">
                <img
                  src="/static/images/gallery/${file}"
                  alt="${meta.alt}"
                  width="600"
                  height="450"
                  decoding="async"
                  loading="lazy"
                  class="w-full h-full object-cover"
                />
                <span class="gallery-card-badge absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-xs">
                  ${meta.catLabel}
                </span>
              </div>
              <div class="p-3 text-[11px] sm:text-xs font-semibold text-slate-800 line-clamp-1 bg-white flex-grow">
                ${meta.title}
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
              <span>View Full Gallery (${rawFiles.length} Photos)</span>
              <i class="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i>
            </a>
          </div>
        </div>
      </section>`;

let indexContent = fs.readFileSync(path.join(root, 'templates', 'index.html'), 'utf8');

const startTag = '<!-- SECTION 3.5: PHOTO GALLERY -->';
const endTag = '<!-- SECTION 4: 33 DISTRICTS OF TELANGANA -->';

const startIndex = indexContent.indexOf(startTag);
const endIndex = indexContent.indexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
  indexContent = indexContent.substring(0, startIndex) + indexGallerySection + '\n\n      ' + indexContent.substring(endIndex);
  fs.writeFileSync(path.join(root, 'templates', 'index.html'), indexContent, 'utf8');
  console.log('Successfully updated templates/index.html with direct /static/images/gallery paths.');
}
