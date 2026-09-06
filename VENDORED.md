# Vendored skills and provenance

This file records why a standalone skill exists here and the exact external
source snapshot or local baseline used to maintain it. A source commit is a
pin, not a claim that the upstream branch is immutable. Re-vendor only after
reviewing the upstream diff, its license, and the focused tests in test/.

## Ponytail

`standalone/ponytail/SKILL.md` is a complete copy of DietrichGebert/ponytail
v4.9.0, released from commit
0a4dd63ad4541f4f655c4108a295916f3c1d8fda, under the MIT license. The local
copy adds only vskills frontmatter metadata (source and source-commit) so
discovery and provenance remain explicit; no synthetic version is injected.
The five ponytail-* satellite skills (ponytail-review, ponytail-audit,
ponytail-debt, ponytail-gain, ponytail-help) were also vendored from the same
upstream release but have been removed from this repository; only the main
skill remains.

Attribution: Copyright DietrichGebert and contributors; MIT license text is
provided by the upstream project at
https://github.com/DietrichGebert/ponytail/blob/main/LICENSE.

## Inspiration without vendored text

The OpenAI curated skill collection at the
[skills catalog](https://github.com/openai/skills), commit
49f948faa9258a0c61caceaf225e179651397431, was reviewed as inspiration while
authoring local manual-only workflows. No external source text is a dependency
of any kept skill: the catalog's wording, structure, and host assumptions were
never copied in, and every kept skill stands alone without it.
