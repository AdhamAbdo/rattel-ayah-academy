// =====================================================================
// data-loader.js
// Fetches published content from Supabase and swaps it into the
// static fallback markup already in index.html. If Supabase isn't
// configured yet, or a request fails, the page simply keeps showing
// the fallback content — nothing breaks.
// =====================================================================

(function () {
  const sb = window.supabaseClient;

  if (!sb) {
    console.warn("Supabase client not found — showing static fallback content.");
    return;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ---------------------------------------------------------------
  // HERO + FOOTER + CONTACT (site_content table)
  // ---------------------------------------------------------------
  async function loadSiteContent() {
    const { data, error } = await sb.from("site_content").select("key, value");
    if (error || !data) return;

    const byKey = {};
    data.forEach((row) => (byKey[row.key] = row.value));

    if (byKey.hero) {
      const h = byKey.hero;
      setText("hero-badge-text", h.badge);
      setText("hero-title", null, true, () => {
        const before = escapeHtml(h.titleBefore || "");
        const highlight = escapeHtml(h.titleHighlight || "");
        const after = escapeHtml(h.titleAfter || "");
        return `${before}<em>${highlight}</em>${after}`;
      });
      setText("hero-description", h.description);
      setText("hero-btn-primary", h.primaryButtonText);
      setText("hero-btn-secondary", h.secondaryButtonText);
      setAttr("hero-btn-primary", "href", h.primaryButtonLink);
      setAttr("hero-btn-secondary", "href", h.secondaryButtonLink);
      if (h.heroImage) setAttr("hero-image", "src", h.heroImage);
      setText("fc1-title", h.floatCard1Title);
      setText("fc1-sub", h.floatCard1Sub);
      setText("fc2-title", h.floatCard2Title);
      setText("fc2-sub", h.floatCard2Sub);
      setText("fc3-title", h.floatCard3Title);
      setText("fc3-sub", h.floatCard3Sub);
    }

    if (byKey.footer) {
      setText("footer-tagline", byKey.footer.tagline);
    }

    if (byKey.contact) {
      const c = byKey.contact;
      if (c.whatsapp) {
        const link = `https://wa.me/${c.whatsapp}`;
        setAttr("nav-whatsapp", "href", link);
        setAttr("cta-whatsapp", "href", link);
        setAttr("footer-whatsapp", "href", link);
        setAttr("footer-phone-link", "href", link);
      }
      if (c.phone) setText("footer-phone-link", c.phone);
      if (c.email) {
        setAttr("cta-email", "href", `mailto:${c.email}`);
        setAttr("footer-email-link", "href", `mailto:${c.email}`);
        setText("footer-email-link", c.email);
      }
    }
  }

  function setText(id, val, isHtml, htmlFn) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isHtml && htmlFn) {
      el.innerHTML = htmlFn();
    } else if (val !== undefined && val !== null && val !== "") {
      el.textContent = val;
    }
  }
  function setAttr(id, attr, val) {
    const el = document.getElementById(id);
    if (el && val) el.setAttribute(attr, val);
  }

  // ---------------------------------------------------------------
  // COURSES
  // ---------------------------------------------------------------
  async function loadCourses() {
    const { data, error } = await sb
      .from("courses")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error || !data || data.length === 0) return;

    const grid = document.getElementById("course-grid");
    if (!grid) return;

    grid.innerHTML = data
      .map((c) => {
        const price = c.price
          ? `<div class="price">${
              c.old_price ? `<span class="old">$${c.old_price}</span>` : ""
            }<span class="new">$${c.price}</span><span class="per">/mo</span></div>`
          : "";
        return `
        <div class="course-card ${c.is_featured ? "featured" : ""} reveal in">
          ${c.is_featured ? `<span class="featured-tag">${escapeHtml(c.category || "Featured")}</span>` : ""}
          <div class="course-media"><img src="${escapeHtml(c.image_url || "")}" alt="${escapeHtml(c.title)}"></div>
          <div class="course-content">
            <div class="course-top"><div class="tags">
              ${c.level ? `<span class="tag level">${escapeHtml(c.level)}</span>` : ""}
              ${c.class_type ? `<span class="tag type">${escapeHtml(c.class_type)}</span>` : ""}
            </div></div>
            ${c.arabic_title ? `<div class="ar-title">${escapeHtml(c.arabic_title)}</div>` : ""}
            <h3>${escapeHtml(c.title)}</h3>
            <p class="desc">${escapeHtml(c.description)}</p>
            <div class="course-meta">
              ${c.duration ? `<span>⏱ ${escapeHtml(c.duration)}</span>` : ""}
              ${c.frequency ? `<span>📅 ${escapeHtml(c.frequency)}</span>` : ""}
            </div>
            <div class="course-bottom">${price}<a class="details-link" href="#contact">View Details →</a></div>
          </div>
        </div>`;
      })
      .join("");
  }

  // ---------------------------------------------------------------
  // TEACHERS
  // ---------------------------------------------------------------
  async function loadTeachers() {
    const { data, error } = await sb
      .from("teachers")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error || !data || data.length === 0) return;

    const grid = document.getElementById("teacher-grid");
    if (!grid) return;

    grid.innerHTML = data
      .map((t) => {
        const specs = (t.specialization || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => `<span class="tag">${escapeHtml(s)}</span>`)
          .join("");
        return `
        <div class="teacher-card reveal in">
          <div class="teacher-top">
            <div class="teacher-avatar"><img src="${escapeHtml(t.image_url || "")}" alt="${escapeHtml(t.name)}"></div>
            <h3>${escapeHtml(t.name)}</h3>
            <div class="role">${escapeHtml(t.title || "")}</div>
          </div>
          <div class="teacher-body">
            ${t.bio ? `<div class="label">About</div><p class="txt">${escapeHtml(t.bio)}</p>` : ""}
            ${specs ? `<div class="label">Specializations</div><div class="teacher-specs">${specs}</div>` : ""}
          </div>
        </div>`;
      })
      .join("");
  }

  // ---------------------------------------------------------------
  // FAQs
  // ---------------------------------------------------------------
  async function loadFaqs() {
    const { data, error } = await sb
      .from("faqs")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error || !data || data.length === 0) return;

    const wrap = document.getElementById("faq-wrap");
    if (!wrap) return;

    wrap.innerHTML = data
      .map(
        (f) => `
        <div class="faq-item reveal in">
          <div class="faq-q">${escapeHtml(f.question)} <span class="plus">+</span></div>
          <div class="faq-a"><div class="faq-a-inner">${escapeHtml(f.answer)}</div></div>
        </div>`
      )
      .join("");

    // Re-bind accordion clicks for the newly injected FAQ items
    wrap.querySelectorAll(".faq-q").forEach((q) => {
      q.addEventListener("click", () => {
        const item = q.parentElement;
        const wasOpen = item.classList.contains("open");
        wrap.querySelectorAll(".faq-item").forEach((i) => i.classList.remove("open"));
        if (!wasOpen) item.classList.add("open");
      });
    });
  }

  // ---------------------------------------------------------------
  // STATISTICS
  // ---------------------------------------------------------------
  async function loadStatistics() {
    const { data, error } = await sb
      .from("statistics")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error || !data || data.length === 0) return;

    const grid = document.getElementById("stats-grid");
    if (!grid) return;

    grid.innerHTML = data
      .map(
        (s) => `<div class="reveal in"><strong>${escapeHtml(s.value)}</strong><span>${escapeHtml(
          s.label
        ).toUpperCase()}</span></div>`
      )
      .join("");
  }

  // ---------------------------------------------------------------
  // TESTIMONIALS
  // ---------------------------------------------------------------
  async function loadTestimonials() {
    const { data, error } = await sb
      .from("testimonials")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error || !data || data.length === 0) return;

    const grid = document.getElementById("testi-grid");
    if (!grid) return;

    const colors = ["#2F7D32", "#7A4B25", "#6EC6D9", "#D4AF37"];
    grid.innerHTML = data
      .map((t, i) => {
        const initial = (t.author_name || "?").trim().charAt(0).toUpperCase();
        const stars = "★".repeat(t.rating || 5);
        return `
        <div class="testi-card reveal in">
          <div class="testi-stars">${stars}</div>
          <p>${escapeHtml(t.quote)}</p>
          <div class="testi-who">
            <div class="testi-avatar" style="background:${colors[i % colors.length]};">${initial}</div>
            <div><strong>${escapeHtml(t.author_name)}</strong><span>${escapeHtml(t.author_role || "")}</span></div>
          </div>
        </div>`;
      })
      .join("");
  }

  // ---------------------------------------------------------------
  // Run all loaders, then re-init scroll-reveal for injected content
  // ---------------------------------------------------------------
  Promise.all([
    loadSiteContent(),
    loadCourses(),
    loadTeachers(),
    loadFaqs(),
    loadStatistics(),
    loadTestimonials(),
  ]).catch((err) => console.warn("Some homepage content failed to load from Supabase:", err));
})();
