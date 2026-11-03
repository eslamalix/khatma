// Readies the production build for GitHub Pages, between `ng build` and `angular-cli-ghpages`.
//
// The service worker refuses a new version when any file it was built with differs from the file the
// site serves (ngsw.json keeps a hash of each). Git on Windows (core.autocrlf) turns CRLF into LF when the
// build is committed to gh-pages, and index.html and manifest.webmanifest carry CRLF from their sources,
// so v0.0.17 was served with hashes that no longer matched: the worker went into a degraded mode and
// kept every returning visitor on the old cached app. `* -text` makes git store each file byte for byte.
import { copyFileSync, writeFileSync } from 'node:fs';

const dir = 'dist/quran-kpi/browser';
copyFileSync(`${dir}/index.html`, `${dir}/404.html`);
writeFileSync(`${dir}/.nojekyll`, '');
writeFileSync(`${dir}/.gitattributes`, '* -text\n');
