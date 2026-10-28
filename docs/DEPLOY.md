# Deploying

ContribMatch is a static site. There is no build step, so there is nothing to
compile: what is in the repository is what is served.

---

## 1. GitHub Pages, from the repository

The quickest route, and the one the project is set up for.

1. Push the repository to GitHub.
2. **Settings → Pages → Build and deployment → Source**: choose **Deploy from
   a branch**.
3. **Branch**: `main`. **Folder**: `/ (root)`.
4. Save, and wait for the deploy. The URL appears at the top of the same
   page.

The site is served from the repository root, so `index.html` is the home page
and every other page is a sibling file.

### Under a project subpath

If the repository is `contribmatch`, the site is served from
`https://<user>.github.io/contribmatch/`.

Every internal link in the project is relative — `app.html`, `../docs/...`,
`packs.html#add` — so this works with no change. The only things to check are
the absolute URLs in these files:

| File | What to check |
| --- | --- |
| `index.html` and every other page | `<link rel="canonical">` and `og:url` should point at the deployed URL. |
| `sitemap.xml` | `https://<user>.github.io/contribmatch/` as the base. |
| `robots.txt` | The `Sitemap:` line. |
| `manifest.webmanifest` | The `start_url` and `scope` need the subpath. |

`js/ui/chrome.js` builds the GitHub link from a constant. Change it once, in
that file, and it is correct everywhere.

## 2. Any other static host

The project is plain files, so anything works: Netlify, Vercel, Cloudflare
Pages, GitLab Pages, or a bucket.

- **Build command:** none.
- **Publish directory:** `/` (the repository root).
- **Headers:** no special headers are required. A `Content-Security-Policy`
  is worth adding if you host it yourself:

```
Content-Security-Policy:
  default-src 'self';
  connect-src 'self' https://api.github.com https://generativelanguage.googleapis.com http://localhost:11434;
  img-src 'self' data:;
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  script-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
```

`connect-src` has to list the origins you actually use. If you run Ollama on
another machine or port, add that origin too.

- **HTTPS is required** for the clipboard API and for `sessionStorage` to
  behave consistently. Every host above gives it by default.

## 3. Running it locally

```bash
npm install      # only for the dev tools
npm run serve    # http://localhost:8080
```

Any static server works:

```bash
python3 -m http.server 8080
npx serve .
```

Opening `index.html` directly with `file://` will **not** work: the app uses
ES modules, which the browser refuses to load over `file://`.

## 4. After deploying: the manual checklist

Everything here needs a browser and your own eyes. The automated checks do
not cover any of it.

### The account and the keys

- [ ] Open **Settings** in the deployed site. The settings panel opens and
      saves.
- [ ] Enter a **GitHub token**. It is a fine-grained, read-only token with
      public repository access. The contribution panel switches to
      **Exact** and shows the full year.
- [ ] Reload the page. The token is gone, because it lives in
      `sessionStorage`. That is correct. Enter it again and it works.
- [ ] Enter an **AI Studio key**. The model panel reports the model it
      reached. A wrong key gives a clear error, not a blank screen.
- [ ] **Never** put a real key in a file in the repository. Check the
      deployment with a repository search for `AIza` before you announce it.

### Ollama, locally

- [ ] `ollama serve` is running.
- [ ] `ollama pull gemma3:4b` (or `gemma3:12b` if you have the memory).
- [ ] `OLLAMA_ORIGINS` includes the origin the site is served from. For
      GitHub Pages that is `https://<user>.github.io`. Without it the browser
      blocks the request before it is made, and the console shows a CORS
      error.
- [ ] The settings screen reports that the model was reached, and the model
      name is shown.
- [ ] Turning Ollama off makes the app fall back to rules, with a visible
      banner. No error state, no dead end.

### The deploy itself

- [ ] The home page loads over HTTPS with no console errors.
- [ ] The **Open the matcher** button in the header works.
- [ ] The favicon, the theme colour and the manifest are all present.
- [ ] The manifest icon loads, and "add to home screen" produces a square
      icon with the right background colour.
- [ ] `sitemap.xml` and `robots.txt` are both served, and the sitemap uses
      the deployed URL.
- [ ] The canonical and the Open Graph URLs on every page use the deployed
      URL, not `localhost`.
- [ ] The Open Graph image loads from a public URL, so a link preview
      renders.
- [ ] The repository link in the footer points at the real repository.

### The product

- [ ] Type a real username. The activity panel loads and says **Approximate**
      without a token.
- [ ] Run the matcher. The steps panel fills in. Results appear.
- [ ] Open a match. The plan, the comment and the checklist are all there.
- [ ] Copy the comment. The toast confirms it, and the text lands in the
      clipboard.
- [ ] Save an issue to the shortlist, reload, and check it is still there.
- [ ] Export the shortlist as Markdown and check the formatting.
- [ ] Switch the language to Hindi and to Hinglish. The interface follows,
      and so does the generated coaching note.
- [ ] Switch the theme. The hero wall, the heatmap and the mascot all follow.
- [ ] Open the site on a phone. The hero graphic has its own band, the
      activity panel is reachable, and nothing scrolls sideways.

### The repository

- [ ] `npm test` passes on a clean checkout.
- [ ] `npm run a11y` passes.
- [ ] `npm run contrast` passes.
- [ ] The repository is public and the license is MIT.
- [ ] The README has a screenshot that matches the deployed site.
- [ ] The issue templates and the pull request template are present.
- [ ] The `docs/` folder is complete.

## 5. Turning on the GitHub token for a deployment

The app never ships a token. The token is entered by the person using the
site, in their own browser, and it stays in their `sessionStorage`.

That is the correct design for a static site. It does mean that every visitor
who wants the exact graph has to create their own token, which is a real
friction. If a deployment ever wants to offer a shared, server-side token,
that is a backend, and it is out of scope for this project on purpose. See
section 3 of [`ARCHITECTURE.md`](ARCHITECTURE.md) for what that would cost.

## 6. Rotating a key that was exposed

1. Revoke it first, on the provider's site. Do not fix the file first.
2. Then fix the file.
3. Then check the history. A key in a commit is a key in the history, and
   `git log -p` is enough to find it.

`SECURITY.md` has the reporting details.
