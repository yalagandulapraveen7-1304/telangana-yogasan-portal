/* ============================================================
   main.js — Shared JavaScript for Telangana Yogasana Portal
   - Mobile nav toggle
   - DOB → Age Category calculator
   - Photo upload preview
   - Form validation
   - Notice board animations
   ============================================================ */

'use strict';

/* ── Utility ─────────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ── Mobile Nav Toggle ───────────────────────────────────── */
function initMobileNav() {
  const toggle = $('#nav-toggle');
  const menu   = $('#nav-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('hidden');
    toggle.setAttribute('aria-expanded', String(!isOpen));
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ── DOB → Age Category Calculator ──────────────────────── */
const AGE_CATEGORIES = [
  { name: 'Sub-Junior', min: 10, max: 14, cssClass: 'badge-subjunior', icon: '🌱' },
  { name: 'Junior',     min: 14, max: 18, cssClass: 'badge-junior',    icon: '⚡' },
  { name: 'Senior',     min: 18, max: 28, cssClass: 'badge-senior',    icon: '🏆' },
];

function calcAgeOnDate(dob, refDate) {
  // Returns age in years (float to allow boundary checks)
  const diff = refDate - dob;
  return diff / (1000 * 60 * 60 * 24 * 365.25);
}

function getCategory(dob) {
  const today = new Date();
  // Championship age = age as of 31 Dec of current year (common sports rule)
  const refDate = new Date(today.getFullYear(), 11, 31);
  const age = calcAgeOnDate(dob, refDate);

  if (isNaN(age) || age < 0) return null;

  for (const cat of AGE_CATEGORIES) {
    if (age >= cat.min && age < cat.max) return cat;
  }
  return { name: 'Not Eligible', min: null, max: null, cssClass: 'badge-ineligible', icon: '⛔' };
}

function initDOBCalculator() {
  const dobInput = $('#dob-input');
  const badge    = $('#age-category-badge');
  const ageDisp  = $('#age-display');
  if (!dobInput || !badge) return;

  function update() {
    const val = dobInput.value;
    if (!val) {
      badge.textContent = '—';
      badge.className = 'badge badge-pending';
      if (ageDisp) ageDisp.textContent = '';
      return;
    }

    const dob = new Date(val);
    const cat = getCategory(dob);

    if (!cat) {
      badge.textContent = '⛔ Invalid Date';
      badge.className = 'badge badge-ineligible';
      return;
    }

    badge.innerHTML = `${cat.icon} ${cat.name}`;

    // Remove old classes, apply new
    badge.className = 'badge ' + cat.cssClass;
    badge.style.fontSize = '.85rem';
    badge.style.padding  = '.3rem 1rem';

    // Show computed age
    if (ageDisp) {
      const today = new Date();
      const yrs  = Math.floor((today - dob) / (1000*60*60*24*365.25));
      ageDisp.textContent = `Age: ${yrs} yr(s) | Championship Year Age: ${
        Math.floor(calcAgeOnDate(dob, new Date(today.getFullYear(), 11, 31)))
      } yr(s)`;
    }

    // Pulse animation
    badge.style.transform = 'scale(1.08)';
    setTimeout(() => badge.style.transform = '', 250);
  }

  dobInput.addEventListener('change', update);
  dobInput.addEventListener('input',  update);
}

/* ── Photo Upload Preview ────────────────────────────────── */
function initPhotoPreview() {
  $$('[data-photo-preview]').forEach(input => {
    const targetId = input.dataset.photoPreview;
    const preview  = document.getElementById(targetId);
    if (!preview) return;

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;

      // Validate type
      if (!file.type.startsWith('image/')) {
        showAlert('Please select an image file (JPG, PNG, etc.)', 'error');
        input.value = '';
        return;
      }

      // Validate size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        showAlert('Photo must be under 2MB', 'error');
        input.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = e => {
        preview.src = e.target.result;
        preview.style.display = 'block';
        preview.classList.add('animate-fade-up');
      };
      reader.readAsDataURL(file);
    });
  });
}

/* ── Document Upload File Name Display ───────────────────── */
function initDocUpload() {
  $$('[data-doc-upload]').forEach(input => {
    const labelId = input.dataset.docUpload;
    const label   = document.getElementById(labelId);
    if (!label) return;

    input.addEventListener('change', () => {
      if (input.files[0]) {
        label.textContent = `✓ ${input.files[0].name}`;
        label.style.color = '#15803d';
        label.style.fontWeight = '600';
      }
    });
  });
}

/* ── Nomination Form Validation & Submission ──────────────────────────── */
function initNominationForm() {
  const form = $('#nomination-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let valid = true;

    // Clear previous errors
    $$('.field-error', form).forEach(el => el.remove());
    $$('.form-input.error, .form-input.is-invalid', form).forEach(el => {
      el.classList.remove('error', 'is-invalid');
      el.style.borderColor = '';
    });

    // Required fields check
    const required = $$('[required]', form);
    required.forEach(field => {
      if (!field.value.trim()) {
        markInvalid(field, 'This field is required');
        valid = false;
      }
    });

    // DOB check
    const dob = $('#dob-input', form);
    if (dob && dob.value) {
      const cat = getCategory(new Date(dob.value));
      if (cat && cat.name === 'Not Eligible') {
        markInvalid(dob, 'Athlete age is outside eligible range (10 – <28 years)');
        valid = false;
      }
    }

    // Aadhaar last 4 digits check
    const aadhaar = $('#aadhaar-input', form);
    if (aadhaar && aadhaar.value && !/^\d{4}$/.test(aadhaar.value)) {
      markInvalid(aadhaar, 'Enter exactly 4 digits');
      valid = false;
    }

    // At least one event checked
    const events = $$('[name="events[]"]:checked', form);
    if (events.length === 0) {
      const evtSection = $('#events-section');
      if (evtSection) {
        const err = makeError('Please select at least one event/discipline');
        evtSection.appendChild(err);
      }
      valid = false;
    }

    if (!valid) return;

    // Submit via Fetch API
    const submitBtn = $('#submit-btn') || form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Submitting...`;
    }

    try {
      const formData = new FormData(form);
      const token = sessionStorage.getItem("token");

      const res = await fetch("/portal/athletes/nominate", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Nomination Successful</span>`;
        }
        showSubmitSuccess(data.athlete._id);
      } else {
        showAlert(data.error || "Failed to submit nomination", "error");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Submit Nomination</span>`;
        }
      }
    } catch (err) {
      console.error("Submission error:", err);
      showAlert("Network error during nomination submission", "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Submit Nomination</span>`;
      }
    }
  });
}
function markInvalid(field, msg) {
  field.style.borderColor = '#ef4444';
  field.classList.add('error');
  const err = makeError(msg);
  field.parentNode.insertAdjacentElement('afterend', err);
}

function makeError(msg) {
  const el = document.createElement('p');
  el.className = 'field-error';
  el.style.cssText = 'color:#ef4444;font-size:.78rem;margin-top:.25rem;';
  el.textContent = msg;
  return el;
}

/* ── Nomination Form Success Popup with Admit Card Link ──── */
function showSubmitSuccess(athleteId = '') {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:1rem;
    backdrop-filter: blur(4px);
  `;
  
  // If an athleteId is passed, show the Admit Card button
  let admitCardButtonHTML = '';
  if (athleteId) {
    admitCardButtonHTML = `
      <a href="admitcard.html?id=${athleteId}" target="_blank" style="
        display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;
        background:#0D5C3A;color:#fff;padding:.875rem 1rem;border-radius:.75rem;
        font-size:.875rem;font-weight:700;text-decoration:none;box-shadow:0 4px 12px rgba(13,92,58,.25);
        margin-bottom:.75rem;transition:background .2s;
      ">
        <i class="fa-solid fa-id-card"></i> View & Print Admit Card (Hall Ticket)
      </a>
    `;
  }

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:1rem;padding:2.5rem;max-width:420px;width:100%;text-align:center;
                box-shadow:0 25px 50px rgba(0,0,0,.25);border-top:4px solid #C5A059;">
      <div style="font-size:3rem;margin-bottom:1rem;">✅</div>
      <h2 style="color:#0D5C3A;font-size:1.25rem;font-weight:800;margin-bottom:.5rem;">
        Nomination Submitted!
      </h2>
      <p style="color:#64748b;margin-bottom:1.5rem;font-size:.9rem;">
        The payment is successful and your athlete nomination has been recorded.
      </p>
      ${admitCardButtonHTML}
      <a href="dashboard.html" style="
        display:block;width:100%;background:#f1f5f9;color:#334155;padding:.75rem 1rem;
        border-radius:.75rem;font-size:.85rem;font-weight:600;text-decoration:none;
      ">
        Go to Dashboard
      </a>
    </div>
  `;
  document.body.appendChild(overlay);
}
/* ── Simple toast alert ──────────────────────────────────── */
function showAlert(msg, type = 'info') {
  const el = document.createElement('div');
  const bg = type === 'error' ? '#fee2e2' : '#dcfce7';
  const co = type === 'error' ? '#991b1b' : '#15803d';
  el.style.cssText = `
    position:fixed;top:1.5rem;right:1.5rem;z-index:9999;
    background:${bg};color:${co};border-radius:.625rem;
    padding:.875rem 1.25rem;font-size:.875rem;font-weight:600;
    box-shadow:0 4px 12px rgba(0,0,0,.15);
    animation:fade-up .3s ease both;
    max-width:320px;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ── Scroll Reveal ───────────────────────────────────────── */
function initScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity  = '1';
        entry.target.style.transform = 'translateY(0)';
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  $$('.reveal').forEach(el => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(28px)';
    el.style.transition = 'opacity .55s ease, transform .55s ease';
    obs.observe(el);
  });
}

/* ── Dashboard Table Search Filter ──────────────────────── */
function initTableSearch() {
  const searchInput = $('#table-search');
  const rows = $$('#nomination-table tbody tr');
  if (!searchInput || rows.length === 0) return;

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    rows.forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

/* ── Drag-Over upload zone highlight ─────────────────────── */
function initDragZones() {
  $$('.upload-zone').forEach(zone => {
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
    zone.addEventListener('drop',      e => { e.preventDefault(); zone.classList.remove('drag-over'); });
  });
}

/* ── Init all on DOM ready ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initDOBCalculator();
  initPhotoPreview();
  initDocUpload();
  initNominationForm();
  initScrollReveal();
  initTableSearch();
  initDragZones();
});
