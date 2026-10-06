# Local fonts

These unmodified WOFF2 files were returned by the official Google Fonts CSS
endpoint for the families and discrete weights already used by ObraSaaS.
`sources.json` records the exact versioned download URLs, byte lengths, SHA-256
checksums, CSS response checksum and pinned Google Fonts license revision.
The adjacent OFL files retain each project's copyright notice and full SIL Open
Font License 1.1. The binaries also retain their embedded copyright metadata.

| Family | Binary version | Published weights | Bytes | Preload |
| --- | --- | --- | ---: | --- |
| Inter | 4.001, git-66647c0bb | 300, 400, 500, 600, 700 | 48,256 | Yes |
| Manrope | 4.504 | 650, 800 | 24,836 | Yes |
| Outfit | 1.100 | 400, 500, 600, 700, 800 | 32,292 | No |

The Latin subsets contain the Spanish letters, accents, opening punctuation and
euro sign used by the public site. They are not a claim of complete coverage of
every language; characters outside the supplied glyphs use the existing CSS
fallbacks. No font was converted, subsetted or renamed locally.

`next/font/local` emits the files as same-origin `/_next/static/media/` assets.
The documented `declarations` option preserves the public `font-family` names
Inter, Manrope and Outfit, so existing canonical, Clerk and legacy styles keep
working without module-by-module typography changes. Each discrete face uses
the same family binary; Next deduplicates the emitted asset. Outfit remains
available to old screens without adding a preload on the canonical landing.

Runtime font loading and builds do not download these files from Google. Updating
a font is an explicit asset change: recheck its license and glyphs, update the
manifest, and validate the compiled typography and layout before publication.
