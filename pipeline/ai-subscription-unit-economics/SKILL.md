---
name: ai-subscription-unit-economics
version: 1.0.0
description: Pricing, limits, and margin gates for a product whose cost of goods is model inference — compute cost per action, cost per active user, and the breakeven limit before choosing a price, then encode the resulting caps as testable invariants. Use when pricing an AI feature or subscription tier, setting rate/usage limits, evaluating whether a plan loses money on heavy users, or estimating the inference cost of a proposed feature.
---

# ai-subscription-unit-economics

For AI products, **usage limits are a pricing decision**, not a technical afterthought. Design them together or the heaviest 5% of users decide your margin.

## Step 1 — Cost per action, bottom-up

For each billable user action, count the tokens honestly:

```
cost_per_action =
    Σ over model calls:
      (input_tokens  × input_price_per_token)
    + (output_tokens × output_price_per_token)
    + (cached_input_tokens × cache_read_price)
    + non-LLM costs (storage, egress, TTS/image/video, third-party APIs)
```

Where people get it wrong:

- **Forgetting retries and failures.** Budget the real retry rate; a failed call still costs input tokens.
- **Forgetting the system prompt and context** — often larger than the user's message, and paid on *every* turn.
- **Forgetting multi-turn growth.** In a conversation, cost per turn rises as history accumulates. Model the whole session, not one call.
- **Assuming a cache hit rate** you haven't measured. Prompt caching is a large lever — verify current pricing and TTL rather than recalling it.
- **Agentic loops.** One user action can be N model calls. Count N at the p50 *and* the p95.

Get current model prices from the source before computing — do not price from memory. (`claude-api` skill for Claude models.)

## Step 2 — Cost per user

```
cost_per_user_month = actions_per_month × cost_per_action
```

Compute at three points — you're pricing a distribution, not an average:

| Cohort | Why it matters |
|---|---|
| **Median user** | Sets your typical margin |
| **p95 user** | Sets your real exposure |
| **Max user under current limits** | Your **worst case per subscriber** — if this exceeds the price, the plan is unbounded-loss by design |

The max-user number is the one people skip and the one that kills subscription AI products.

## Step 3 — The margin gate

```
gross_margin = (price − cost_per_user_month) / price
```

Decide the floor **before** you fall in love with a price. Then solve the other direction:

```
breakeven_actions = (price × (1 − target_margin)) / cost_per_action
```

That number **is your usage cap**. A tier whose limit isn't derived from this is guessing.

Sanity checks:
- Does the p95 user still clear the margin floor? If not, the cap is too high or the price is too low.
- Does the cap leave the median user comfortably unconstrained? If not, you'll churn the people you wanted.
- What's the marginal cost of the cheapest paid tier vs free? Free tiers need a hard cap, not a soft one.

## Step 4 — Levers before raising price

In rough order of preference:

1. **Cheaper model for the cheap parts** — routing simple steps to a smaller model is usually the biggest single win.
2. **Prompt caching** for stable system prompts and long context.
3. **Trim context** — truncate history, summarize, retrieve instead of stuffing.
4. **Cap output tokens** — output is typically the expensive side.
5. **Deduplicate work** — cache results of identical requests.
6. **Batch** where latency permits.
7. **Then** adjust limits or price.

## Step 5 — Encode the result as invariants

Feed these into `planner`'s invariant lock so they become testable, not aspirational:

```
- Cost per <action> must not exceed $X at p95 (measured, with a test/monitor)
- Tier <name> hard-caps at N <actions>/month; enforcement point: <where>
- No user action may issue more than K model calls
- Max output tokens per call: T
- Cache hit rate assumed: H% — alert if it drops below H−10
```

An unenforced cap is a wish. Each of these needs an enforcement point and a signal — see `audit`.

## Non-negotiables

- Look up **current** model pricing; never price from memory.
- Model the max user, not just the average.
- Limits and price are decided together.
- Live provider spend is **separately authorized** — measuring real costs may itself cost money. Ask first.
- State your assumptions (tokens per call, retry rate, cache hit rate) next to the numbers, so they can be checked later.

## Related

`planner` (invariant lock) · `audit` · `controlled-ticket-delivery` · `claude-api`
