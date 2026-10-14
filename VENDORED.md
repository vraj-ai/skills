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

## Third-party packs

These trees are complete upstream copies. They sit outside the vskills
catalogue: src/discovery.js skips the third-party directory, so vskills init
does not install them and they do not change the kept skill set. Re-vendor
only after reviewing the upstream diff and its license.

### Matt Pocock

third-party/mattpocock/skills is mattpocock/skills at commit
49dd158d1076134a641b33efb035946536778336, MIT. The license file is
third-party/mattpocock/LICENSE. Copyright Matt Pocock.

### Addy Osmani

third-party/addyosmani/skills and third-party/addyosmani/references are
addyosmani/agent-skills at commit
aeac41d4d005999432bb7312f7ff06383a91d59d, MIT. The license file is
third-party/addyosmani/LICENSE. Copyright Addy Osmani. Skill files refer to
the references directory one level above skills, so that directory is part of
the copy.

### Frontend design

third-party/frontend-design is the frontend-design skill from
anthropics/skills at commit
dbd4588f9e1033efb41dad4bef2f7947c8993d44, Apache-2.0. The license file is
third-party/frontend-design/LICENSE.txt. This is the design skill the fleet
roster audit measured and did not prune. design-an-interface is not in
this tree.
