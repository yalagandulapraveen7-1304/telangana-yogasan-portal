const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const templatesDir = path.join(root, 'templates');
const siteUrl = (process.env.SITE_URL || 'https://telanganayoga.org.in').replace(/\/+$/, '');

// Routes and metadata configuration
const pageConfigs = {
  'index.html': {
    canonical: `${siteUrl}/`,
    breadcrumbName: 'Home',
    isHome: true,
    hasOrgSchema: true
  },
  'about.html': {
    canonical: `${siteUrl}/about`,
    breadcrumbName: 'About Us',
    hasOrgSchema: true
  },
  'activities.html': {
    canonical: `${siteUrl}/activities`,
    breadcrumbName: 'Yoga Activities'
  },
  'events.html': {
    canonical: `${siteUrl}/events`,
    breadcrumbName: 'Events & Championships',
    hasEventSchema: true
  },
  'districts.html': {
    canonical: `${siteUrl}/districts`,
    breadcrumbName: 'District Directory'
  },
  'membership.html': {
    canonical: `${siteUrl}/membership`,
    breadcrumbName: 'Membership'
  },
  'results.html': {
    canonical: `${siteUrl}/results`,
    breadcrumbName: 'Results & Records'
  },
  'downloads.html': {
    canonical: `${siteUrl}/downloads`,
    breadcrumbName: 'Downloads & Circulars'
  },
  'gallery.html': {
    canonical: `${siteUrl}/gallery`,
    breadcrumbName: 'Photo Gallery'
  },
  'help.html': {
    canonical: `${siteUrl}/help`,
    breadcrumbName: 'Help & FAQ'
  },
  'contact.html': {
    canonical: `${siteUrl}/contact`,
    breadcrumbName: 'Contact Us',
    hasOrgSchema: true
  },
  'privacy-policy.html': {
    canonical: `${siteUrl}/privacy-policy`,
    breadcrumbName: 'Privacy Policy'
  },
  'terms.html': {
    canonical: `${siteUrl}/terms`,
    breadcrumbName: 'Terms & Conditions'
  },
  'nominate.html': {
    canonical: `${siteUrl}/nominate`,
    breadcrumbName: 'Athlete Nomination'
  },
  'school-nominate.html': {
    canonical: `${siteUrl}/school-nominate`,
    breadcrumbName: 'School Nomination'
  },
  'admitcard.html': {
    canonical: `${siteUrl}/admitcard`,
    breadcrumbName: 'Admit Card Verification'
  },
  'login.html': {
    noindex: true
  },
  'dashboard.html': {
    noindex: true
  },
  '404.html': {
    noindex: true
  }
};

// 1. Common JSON-LD schemas
const sportsOrgSchema = {
  '@context': 'https://schema.org',
  '@type': 'SportsOrganization',
  'name': 'Telangana Yoga Association',
  'alternateName': 'Telangana State Yoga Association',
  'url': `${siteUrl}/`,
  'logo': `${siteUrl}/static/images/TSYSC.png`,
  'email': 'contact@telanganayoga.org.in',
  'telephone': '+91-98490-12345',
  'address': {
    '@type': 'PostalAddress',
    'streetAddress': 'State Sports Secretariat',
    'addressLocality': 'Hyderabad',
    'addressRegion': 'Telangana',
    'postalCode': '500001',
    'addressCountry': 'IN'
  },
  'parentOrganization': {
    '@type': 'SportsOrganization',
    'name': 'Yoga Federation of India'
  },
  'sport': 'Yogasana Sports'
};

const sportsEventSchema = {
  '@context': 'https://schema.org',
  '@type': 'SportsEvent',
  'name': '13th Telangana State Inter-District Yogasana Sports Championship',
  'description': 'Official state selection trials and competition rounds across 5 disciplines with certified national referee panel conducted in accordance with Yoga Federation of India rules.',
  'sport': 'Yogasana Sports',
  'eventStatus': 'https://schema.org/EventScheduled',
  'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
  'organizer': {
    '@type': 'SportsOrganization',
    'name': 'Telangana Yoga Association',
    'url': `${siteUrl}/`
  },
  'location': {
    '@type': 'Place',
    'name': 'Telangana State Sports Complex / District Headquarters',
    'address': {
      '@type': 'PostalAddress',
      'addressLocality': 'Hyderabad',
      'addressRegion': 'Telangana',
      'addressCountry': 'IN'
    }
  },
  'offers': {
    '@type': 'Offer',
    'price': '260',
    'priceCurrency': 'INR',
    'availability': 'https://schema.org/InStock',
    'url': `${siteUrl}/nominate`,
    'validFrom': '2026-01-01',
    'description': 'Flat registration fee per competitive discipline event (?260/event)'
  }
};

function getBreadcrumbSchema(pageName, pagePath) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': `${siteUrl}/`
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': pageName,
        'item': pagePath
      }
    ]
  };
}

// Process all templates
fs.readdirSync(templatesDir).filter(f => f.endsWith('.html')).forEach(filename => {
  const filePath = path.join(templatesDir, filename);
  let html = fs.readFileSync(filePath, 'utf8');
  const cfg = pageConfigs[filename];
  if (!cfg) return;

  // Clean existing canonical, robots, and application/ld+json tags in <head> to avoid duplicates
  html = html.replace(/\s*<link\s+rel=["']canonical["'][^>]*>/gi, '');
  html = html.replace(/\s*<meta\s+name=["']robots["'][^>]*>/gi, '');
  html = html.replace(/\s*<script\s+type=["']application\/ld\+json["']>[\s\S]*?<\/script>/gi, '');

  let headInjections = [];

  // Canonical or Noindex
  if (cfg.noindex) {
    headInjections.push('    <meta name="robots" content="noindex, nofollow" />');
  } else if (cfg.canonical) {
    headInjections.push(`    <link rel="canonical" href="${cfg.canonical}" />`);
  }

  // Schemas
  if (cfg.hasOrgSchema) {
    headInjections.push(`    <script type="application/ld+json">\n${JSON.stringify(sportsOrgSchema, null, 2).split('\n').map(l => '    ' + l).join('\n')}\n    </script>`);
  }
  if (cfg.hasEventSchema) {
    headInjections.push(`    <script type="application/ld+json">\n${JSON.stringify(sportsEventSchema, null, 2).split('\n').map(l => '    ' + l).join('\n')}\n    </script>`);
  }
  if (!cfg.isHome && cfg.canonical && cfg.breadcrumbName) {
    const bcSchema = getBreadcrumbSchema(cfg.breadcrumbName, cfg.canonical);
    headInjections.push(`    <script type="application/ld+json">\n${JSON.stringify(bcSchema, null, 2).split('\n').map(l => '    ' + l).join('\n')}\n    </script>`);
  }

  if (headInjections.length > 0) {
    // Insert right before </head>
    html = html.replace('</head>', `${headInjections.join('\n')}\n  </head>`);
  }

  // Upgrade visual breadcrumbs into semantic <nav aria-label="Breadcrumb">
  // Pattern 1: Hero header breadcrumb div
  html = html.replace(
    /<div class="flex items-center gap-2 text-xs text-emerald-200 mb-2">\s*<a href="\/" class="hover:text-white">Home<\/a>\s*<i class="fa-solid fa-chevron-right text-\[10px\]" aria-hidden="true"><\/i>\s*<span class="text-amber-300">([^<]+)<\/span>\s*<\/div>/g,
    (m, p1) => `<nav aria-label="Breadcrumb" class="flex items-center gap-2 text-xs text-emerald-200 mb-2">
            <a href="/" class="hover:text-white">Home</a>
            <i class="fa-solid fa-chevron-right text-[10px]" aria-hidden="true"></i>
            <span class="text-amber-300 font-semibold" aria-current="page">${p1}</span>
          </nav>`
  );

  // Pattern 2: gallery.html header breadcrumb
  if (filename === 'gallery.html' && !html.includes('aria-label="Breadcrumb"')) {
    html = html.replace(
      '<div class="max-w-7xl mx-auto">\n        <!-- Title & Header Banner -->',
      `<div class="max-w-7xl mx-auto">
        <!-- Breadcrumb Navigation -->
        <nav aria-label="Breadcrumb" class="mb-4">
          <div class="flex items-center space-x-2 text-xs text-slate-600">
            <a href="/" class="hover:text-[#0D5C3A] flex items-center gap-1">
              <i class="fa-solid fa-house text-[10px]" aria-hidden="true"></i> Home
            </a>
            <span class="text-slate-400">/</span>
            <span class="text-slate-900 font-semibold" aria-current="page">Photo Gallery</span>
          </div>
        </nav>
        <!-- Title & Header Banner -->`
    );
  }

  // Pattern 3: admitcard.html header breadcrumb
  if (filename === 'admitcard.html' && !html.includes('aria-label="Breadcrumb"')) {
    html = html.replace(
      '<div class="max-w-3xl mx-auto">\n        <!-- Admit Card Download Header Banner -->',
      `<div class="max-w-3xl mx-auto">
        <!-- Breadcrumb Navigation -->
        <nav aria-label="Breadcrumb" class="mb-4">
          <div class="flex items-center space-x-2 text-xs text-slate-600">
            <a href="/" class="hover:text-[#0D5C3A] flex items-center gap-1">
              <i class="fa-solid fa-house text-[10px]" aria-hidden="true"></i> Home
            </a>
            <span class="text-slate-400">/</span>
            <span class="text-slate-900 font-semibold" aria-current="page">Admit Card Verification</span>
          </div>
        </nav>
        <!-- Admit Card Download Header Banner -->`
    );
  }

  // Add footer links for Data Deletion Procedure and Cookie Disclosure if not present
  if (!html.includes('href="/privacy-policy#data-deletion"')) {
    html = html.replace(
      '<a href="/privacy-policy" class="footer-link">Privacy Policy</a>',
      '<a href="/privacy-policy" class="footer-link">Privacy Policy</a>\n              <li><a href="/privacy-policy#data-deletion" class="footer-link">Data Deletion Policy</a></li>\n              <li><a href="/privacy-policy#cookies-policy" class="footer-link">Cookie Disclosure</a></li>'
    );
  }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`Updated metadata, canonical, breadcrumbs, and schema in ${filename}`);
});
