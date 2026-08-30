# Vendored skills and provenance

This file records why a standalone skill exists here and the exact external
source snapshot or local baseline used to maintain it. A source commit is a
pin, not a claim that the upstream branch is immutable. Re-vendor only after
reviewing the upstream diff, its license, and the focused tests in test/.

## Ponytail family

The six Ponytail skills are complete copies of DietrichGebert/ponytail v4.9.0,
released from commit
0a4dd63ad4541f4f655c4108a295916f3c1d8fda, under the MIT license. The local
copies add only vskills frontmatter metadata (source and source-commit) so
discovery and provenance remain explicit; no synthetic version is injected.

| Local skill | Upstream path |
|---|---|
| ponytail | skills/ponytail/SKILL.md |
| ponytail-review | skills/ponytail-review/SKILL.md |
| ponytail-audit | skills/ponytail-audit/SKILL.md |
| ponytail-debt | skills/ponytail-debt/SKILL.md |
| ponytail-gain | skills/ponytail-gain/SKILL.md |
| ponytail-help | skills/ponytail-help/SKILL.md |

Attribution: Copyright DietrichGebert and contributors; MIT license text is
provided by the upstream project at
https://github.com/DietrichGebert/ponytail/blob/main/LICENSE.

## Browser-control replacement

`standalone/browser-control/SKILL.md` is an original, concise, manual-only
workflow authored by Vraj / vraj-ai and licensed MIT. It is harness and model
agnostic, selecting among the active host's browser capability, connector, API,
or CLI while enforcing visible-state verification and browser automation safety.

The OpenAI bundled browser package 26.825.31414 was reviewed as inspiration
only (package metadata identifies it as proprietary); no OpenAI source text,
plugin internals, or unavailable runtime names are redistributed here. The
inspiration reference is the public browser plugin overview at
https://github.com/openai/openai/tree/master/lib/browser_use/plugin.

## GitHub workflow

`standalone/github-workflow/SKILL.md` is an original, complete, manual-only
workflow authored by Vraj / vraj-ai and licensed MIT. It is standalone and
harness/model agnostic: it selects among available connector, API, and CLI
capabilities and contains its review, CI, and explicit-write-authority
procedures without sibling-skill routes or host-specific runtime assumptions.

The OpenAI curated GitHub skill at the
[skills catalog](https://github.com/openai/skills), commit
49f948faa9258a0c61caceaf225e179651397431, was reviewed as inspiration while
addressing the P1; no external source text or unavailable host language is a
dependency of the local workflow.

The Pi maintenance workflows are host/model agnostic at their invariant
boundaries. The GitHub workflow names connector and CLI capabilities rather
than a model. Browser-control is a clean-room local workflow and does not
preserve concrete host or plugin internals.

## Pi maintenance

pi-usage-maintenance and pi-setup-maintenance are authored in this repository
for the approved Pi setup. They have no external license dependency and are
manual-only by design. Their source baseline is repository commit
2a1e1155497bcea1c561c6415e801ca1790e83e5; update this entry when the local
maintenance contract changes.
