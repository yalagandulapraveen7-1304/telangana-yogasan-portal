/**
 * Architecture Documentation Interactive Script Module
 * Powers scrollspy, dynamic search filtering, code copying, theme switching, and collapsible sections.
 */

module.exports = `
document.addEventListener('DOMContentLoaded', () => {
  // 1. Theme Toggle
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const currentTheme = localStorage.getItem('doc-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);

  if (themeToggleBtn) {
    themeToggleBtn.innerHTML = currentTheme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
    themeToggleBtn.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = activeTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('doc-theme', newTheme);
      themeToggleBtn.innerHTML = newTheme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
    });
  }

  // 2. Mobile Sidebar Toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const docSidebar = document.getElementById('docSidebar');
  if (mobileMenuBtn && docSidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      docSidebar.classList.toggle('open');
    });
  }

  // 3. ScrollSpy Navigation
  const tocLinks = document.querySelectorAll('.toc-item a');
  const sections = document.querySelectorAll('.doc-section');

  function updateActiveToc() {
    let currentActiveId = '';
    const scrollPos = window.scrollY + 120;

    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentActiveId = section.getAttribute('id');
      }
    });

    tocLinks.forEach((link) => {
      const href = link.getAttribute('href');
      const item = link.closest('.toc-item');
      if (href === '#' + currentActiveId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  window.addEventListener('scroll', updateActiveToc, { passive: true });
  updateActiveToc();

  // 4. Live Search & Filter in Table of Contents
  const searchInput = document.getElementById('sidebarSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const tocItems = document.querySelectorAll('.toc-item');

      tocItems.forEach((item) => {
        const text = item.textContent.toLowerCase();
        if (!query || text.includes(query)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  // 5. Code Copy Buttons
  document.querySelectorAll('.btn-copy-code').forEach((btn) => {
    btn.addEventListener('click', () => {
      const container = btn.closest('.code-container');
      const code = container.querySelector('code')?.innerText || '';
      navigator.clipboard.writeText(code).then(() => {
        const originalText = btn.innerText;
        btn.innerText = 'Copied!';
        btn.style.color = '#10b981';
        btn.style.borderColor = '#10b981';
        setTimeout(() => {
          btn.innerText = originalText;
          btn.style.color = '';
          btn.style.borderColor = '';
        }, 2000);
      });
    });
  });

  // 6. Print Button
  const printBtn = document.getElementById('printDocBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }
});
`;
