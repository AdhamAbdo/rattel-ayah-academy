# Rattel Ayah Academy

A small Islamic-education academy website with a Supabase-backed admin dashboard.

```
RATTEL-AYAH-ACADEMY/
│
├── Home/                     Public website
│   ├── index.html
│   ├── style.css
│   ├── script.js             FAQ accordion + teachers swiper (UI only)
│   └── data-loader.js        Fetches content from Supabase and renders it
│
├── Admin/                    Admin dashboard (Supabase Auth gated)
│   ├── admin.html
│   ├── admin.css
│   └── admin.js              Auth + CRUD against Supabase
│
├── assets/
│   ├── supabase-config.js    Your Supabase URL + anon key go here
│   └── images/
│       ├── courses/          7 course thumbnails (already included)
│       ├── teachers/         4 teacher photos + 1 spare avatar (already included)
│       └── site/             Add your logo.png, favicon.png, hero.jpg here
│
├── supabase/
│   └── schema.sql            Run this once in your Supabase project
│
├── .env.example
├── .gitignore
├── vercel.json                Routes "/" → Home, "/admin" → Admin
└── README.md
```

## 1. What changed from the original project

- The homepage no longer stores images as inline base64 — it links to real files in `assets/images/`, matching the images you already had.
- `index.html` and `admin.js` now talk to a real database (Supabase Postgres) instead of `localStorage`. If Supabase isn't configured yet, the homepage still renders using the fallback content baked into `index.html`, so the site is never blank.
- The admin dashboard now has a **real** login (Supabase Auth email/password) instead of the bypassed login gate.
- Nothing about the visual design, section layout, or existing CSS was rebuilt from scratch — `style.css` and `admin.css` are your original files, unchanged.

## 2. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → New project. Pick any name/region and a database password (save it somewhere safe).
2. Once it's ready, open **SQL Editor** → New query, paste the entire contents of `supabase/schema.sql`, and run it. This creates all tables, Row Level Security policies, and seeds them with your current homepage content (courses, teachers, FAQs, etc.) so the site looks the same the moment you connect it.

## 3. Configure environment (connect the site to Supabase)

This is a plain static site with no build step, so environment variables aren't injected automatically at deploy time — you put the two public values directly into `assets/supabase-config.js`:

1. In Supabase, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon / public key**.
3. Open `assets/supabase-config.js` and replace the two placeholder values:
   ```js
   window.SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
   window.SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
   ```

The anon key is meant to be public — it's protected by the Row Level Security policies in `schema.sql` (public visitors can only read `is_active = true` rows; only authorized admins can write). **Never** put your `service_role` key anywhere in this project.

## 4. Create your first admin account

1. In Supabase: **Authentication → Users → Add user** (or "Invite"). Create yourself an account with your email + a password.
2. Copy that user's **UID** (shown in the users table).
3. Back in **SQL Editor**, run:
   ```sql
   insert into admins (user_id) values ('paste-the-uid-here');
   ```
4. That's it — that account can now sign in at `/admin` and has write access. Repeat step 1–3 for any other admins.

## 5. Add your own site images (optional)

The 7 course thumbnails and 4 teacher photos you already had are included and wired up. Three images referenced by the homepage don't exist yet because they weren't part of the original upload — add them to `assets/images/site/` and the page will pick them up automatically (it degrades gracefully without them):

- `logo.png` — used in the nav and footer
- `favicon.png` — browser tab icon
- `hero.jpg` — the large image in the hero section

You can also just replace these later from the **Hero** panel in the admin dashboard (image URL field) once you're using Supabase Storage — see the note in section 9.

## 6. Run it locally

Since it's a static site, any simple local server works. From the project root:

```bash
npx serve .
```

Then visit `http://localhost:3000/Home/index.html` for the site and `http://localhost:3000/Admin/admin.html` for the dashboard. (Vercel's rewrites for clean `/` and `/admin` URLs only apply once deployed — see below.)

## 7. Push to GitHub

```bash
git init
git add .
git commit -m "Rattel Ayah Academy — Supabase-backed site"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/rattel-ayah-academy.git
git push -u origin main
```

`.env` is already git-ignored. There are no secrets in this repo — the anon key in `assets/supabase-config.js` is safe to commit for the reasons explained in section 3.

## 8. Deploy to Vercel

1. In Vercel, **Add New Project** → import the GitHub repo you just pushed.
2. Framework preset: **Other** (it's a static site, no build command needed).
3. Deploy. `vercel.json` in the repo root routes:
   - `/` → `Home/index.html`
   - `/admin` → `Admin/admin.html`
4. Once deployed, visit `your-site.vercel.app` for the public site and `your-site.vercel.app/admin` to sign in.

## 9. Testing checklist

- [ ] Add a teacher in `/admin` → refresh the homepage → teacher appears in the Teachers section.
- [ ] Edit a course's price/description → refresh homepage → change reflects.
- [ ] Delete a teacher → refresh homepage → teacher disappears.
- [ ] Disable (don't delete) a course → refresh homepage → course disappears, but is still editable/re-enable-able from `/admin`.
- [ ] Log out of `/admin` → reload `/admin` → you're back at the login form.
- [ ] Try visiting `/admin` in an incognito window without logging in → you see only the login form, no content or data.

## Image uploads from the admin panel (current limitation)

Right now, adding/editing a teacher or course in the admin panel takes an **image URL** (a link to an already-hosted image), not a file upload button. This keeps the initial build simple and avoids extra moving parts. To add real "upload a photo from your computer" support:

1. In Supabase, create a **Storage** bucket (e.g. `site-images`), set it to public read.
2. Add a Storage policy allowing `insert`/`update`/`delete` only for authenticated admins (mirror the `is_admin()` pattern used in `schema.sql`).
3. In `admin.js`, replace the plain "Image URL" text field with a file `<input type="file">` that calls `sb.storage.from('site-images').upload(...)`, then use the returned public URL as `image_url`.

This is the main recommended next step — everything else in the spec (auth, RLS, CRUD, dynamic homepage) is fully wired up.

## Other future improvements

- Course → instructor linking currently isn't exposed as a dropdown in the admin UI (the database column exists, `courses.instructor_id`, but you'd need to set it via SQL or a small UI addition).
- No pagination — fine for a small academy site with a handful of courses/teachers, but worth adding if the lists grow large.
- No image optimization/resizing pipeline for uploaded photos.
