# Security policy

ContribMatch is a static site with no backend. That is a security property,
not an accident, and most of the rules below follow from it.

## What the app does and does not do

| It does | It does not |
| --- | --- |
| Read public GitHub data from the browser | Store anything on a server |
| Keep a token or an API key in `sessionStorage` | Write a secret into the repository, a log, or a URL |
| Keep the shortlist in `localStorage` | Post a comment, a review or a pull request |
| Send a prompt to a local Ollama or to Google AI Studio | Send your code, your issues or your tokens anywhere else |

## If you find a vulnerability

**Do not open a public issue.** Report it privately instead:

1. Use GitHub's **Security → Report a vulnerability** button on this
   repository (the private advisory form), or
2. Email the maintainers at the address in the repository's `package.json`
   author field.

Include, if you can: the page, what you did, what you expected, and the
impact. A proof of concept helps, but please do not access other people's data
and do not run automated scans against the live deployment.

You can expect an acknowledgement within 72 hours and a decision within seven
days. We will tell you when a fix has shipped, and we will credit you in the
release notes unless you would rather we did not.

## What counts as a vulnerability here

- A secret being persisted somewhere it should not be: `localStorage`, a
  query string, a log line, a bundled file.
- Untrusted text (an issue title, a repository name, model output) being
  inserted as HTML, which would let a malicious repository run script in the
  page.
- The app sending data to a host other than `api.github.com`, the configured
  Ollama origin, or the Google AI Studio endpoint.
- A path traversal or a cross-site scripting bug in the pack loader, the
  shortlist importer, or the Markdown export.

## What does not count

- Rate limits from GitHub or from Google. Those are expected and the app
  handles them with a friendly message.
- The absence of a server-side rate limiter. There is no server.
- Reports about model output quality.
- Reports about a token being stored in `sessionStorage`. That is the
  documented, intended design: it clears when the tab closes, and it is never
  transmitted anywhere but to the API it belongs to.

## Handling secrets safely

- A **GitHub token** only ever goes to `api.github.com`. Use a fine-grained
  token with read-only public repository access. It is stored in
  `sessionStorage` under `contribmatch:v1:secrets` and disappears when the tab
  closes.
- An **AI Studio key** only ever goes to the Google AI Studio endpoint. Same
  storage rules.
- **Never commit a real key.** `.env` files are not read by the app; the
  project has no server-side environment at all. If you add a key to a
  file by accident, revoke it on GitHub first, then fix the file.

## Reporting a dependency problem

`npm install` pulls Puppeteer and axe-core, which are development-only. They
are never bundled into the site. Run `npm audit` and report anything serious
through the same private channel.
