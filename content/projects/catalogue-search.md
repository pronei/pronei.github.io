---
title: catalogue-search
weight: 6
summary: A one-of-a-kind fashion catalogue for one person with a specific size — keyword, text-vector and photo-vector search over 25 independent brands, measured by an LLM judge.
stack: [TypeScript, Node.js, Hono, SQLite FTS5, transformers.js, Claude API]
metrics:
  - about 6,400 pieces from 25 independent brands, re-read every night
  - NDCG@10 0.824 → 0.900 from adding photo vectors, on 97 judged queries
  - two embedding models on a six-core CPU with no GPU, about 9 ms and 22 ms per query
links:
  note: private code · walkthrough on request
---

I built this for one person, in one specific size. Independent fashion labels each run their
own shop, so finding something that exists, fits and looks right means opening twenty-five
tabs. This catalogue reads every brand's published product feed overnight and answers a
query in one place: "red coat", "high neck dress", German or English, typos included.

## why it's harder than it looks

When I measured the index in October, product titles named the neckline for 2% of pieces,
the sleeves for 1% and the color for 62%. Sizes arrive as letters, UK and EU numbers, bra
sizes and made-to-measure, and three brands publish none at all, so "in my size" is a filter
with an *unverified* lane rather than a yes or no. A keyword engine only finds what the text
says, and the text says very little.

## how a search runs

{{< steps "every night" >}}
- **crawl** each brand's published product feed, respecting robots.txt, one request at a time per site
- **classify** into 13 categories and 6 materials; parse letter, numeric and bra sizes per brand
- **tag** new or changed photos with Claude Haiku in a batch, answered against a JSON schema: neckline, sleeves, length, closure, color
- **embed** each piece's words (multilingual-e5-base) and its card photo (Marqo-FashionSigLIP), both 8-bit, on CPU with transformers.js
{{< /steps >}}
{{< steps "every search" >}}
- **parse** category, material, size and style words out of the query; correct typos and say so
- **match** in SQLite FTS5 with BM25 field weights; every part of the query is required and filters stay hard
- **boost** by meaning: cosine to every stored vector, z-scored per model, blended 0.85 photo to 0.15 text
- **rescue** thin results: under ten strict matches, up to 24 related pieces that still pass every filter go below them
{{< /steps >}}

Vectors never override a filter. A piece in the wrong size or category doesn't come back,
however close it looks.

## measuring it

I wrote 97 test queries in ten groups, from plain categories and colors to German, typos,
brand names, vague requests and three that should return nothing. For every change, Claude
Haiku grades the top 20 results as exact, substitute, complement or irrelevant. It looks at
the product photo and the shop's own listing text, never at my tags, so the search can't
grade its own homework. Grades are cached, so a re-run only pays for results it hasn't seen.
The scorer reports NDCG@10, P@10 and the zero-result rate.

The photo weight came out of a sweep:

| meaning from | NDCG@10 | P@10 |
|---|--:|--:|
| text vectors only | 0.824 | 0.887 |
| blend, photo weight 0.5 | 0.880 | 0.929 |
| blend, photo weight 0.7 | 0.892 | 0.934 |
| blend, photo weight 0.85 | 0.899 | 0.940 |
| photo vectors only | 0.897 | 0.944 |

Photos alone had the best precision, but they can't read: one misspelled query fell to 0.38
without the text model. At 0.85 the text side still carries German and typos at no measured
cost. Color queries went from 0.680 to 0.881, vague ones from 0.662 to 0.838 and German ones
from 0.796 to 0.910. With the color rule below on top, the shipped version scores 0.900
NDCG@10 and 0.940 P@10, and no test query comes back empty.

## decisions worth defending

- **z-scores before blending.** The text model's raw cosine similarities all sit in a narrow,
  high band, and the photo model works on a different scale. Standardizing each model's
  scores per query makes "unusually close" mean the same thing for both, so one threshold
  works for every query.
- **No vector database.** About 6,500 vectors of 768 dimensions is roughly 20 MB per model.
  Scanning all of them takes milliseconds in plain TypeScript; a database would add a daemon
  to a small server for nothing.
- **Color comes from the photo.** "gold dress" once ranked a black dress with a gold zip
  first, because the text said "gold". Now, once a photo is tagged, only the tags and the
  shop's color options decide a plain color. Patterns kept the text rule: the first version
  of this change cut "leopard print" from 183 results to 40 and its score from 0.70 to 0.64.
- **Tagging is batch work.** New or changed photos go to Claude Haiku overnight through the
  Message Batches API. Re-tagging about 5,900 pieces cost $1.17.

## manners

The crawler identifies itself, reads only what each shop publishes, respects robots.txt and
makes one request at a time per site. Photos are proxied and never stored; only their vectors
are. The query log keeps normalized words and counts: no addresses, no sizes, no times of day.

## what's still weak

When I last measured, brand-plus-garment queries scored 0.60 to 0.70, prefix expansion
over-matched ("gala" also finds "galaxy"), and four-letter typos slipped through. Next on
paper is serving the search from Cloudflare instead of a home server, and it only ships if
its judged score stays within 0.01 of today's.
