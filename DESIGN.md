# Design constraints

Read this before touching anything visual. It exists because AI-assisted work
drifts toward the same house style, and that style is now recognisable enough
that a visitor reads it as "generated" before they read a word of the copy.
Every rule below is a specific tell, followed by what we do instead.

## The tells, and our answers

| Tell | Ours |
|---|---|
| Inter / Geist / Space Grotesque everywhere | **Bricolage Grotesque** display, **Instrument Sans** text, **Newsreader** for editorial accents |
| A pill badge sitting above the H1 | No badge. The headline is the first thing on the page. |
| Numbered 1-2-3 step sequences | Prose, or a labelled sequence that is not a countdown |
| A row of identical cards with an icon on top | One layout primitive: a rule, a label, and text. Repeated. |
| Purple/lavender gradients, coloured glows | Flat ink on paper. One accent: **ochre `#c2571a`**. |
| Glassmorphism, frosted panels | Solid surfaces, hairline rules |
| All-caps section labels in medium grey | Sentence case, and only where a label earns its place |
| Stat banner rows | A number stated in a sentence, where it is being argued |
| Emoji in the nav or sidebar | Words |

## The three deliberate choices

1. **Palette** — warm ink on warm paper, not blue-black on white. A single
   ochre accent, used for one thing per screen. No second accent colour: the
   moment there are two, everything becomes a candidate for colour and the page
   stops having a focal point.

2. **Type** — Bricolage Grotesque for display, tight tracking at large sizes.
   Instrument Sans for text. Newsreader italic for the one editorial aside per
   section. Three faces is the ceiling.

3. **One primitive** — a hairline rule, an optional small label, then content.
   That is the whole system. Where a card seems necessary, ask what the border
   is doing that whitespace could not.

## Copy rules

- **Show, don't claim.** A screenshot of the product doing the thing beats any
  sentence about it doing the thing. This is the single highest-leverage rule
  on the page.
- **Say less than necessary.** If a sentence survives being cut in half, cut it.
- **Never a number we cannot produce.** Every figure on the page is computed
  from real product data or is not stated.
- **No manufactured urgency.** No countdowns, no fake scarcity, no "only 3
  spots". They convert once and cost the relationship.

## Accessibility floor

Body text ≥ 4.5:1 against its background in both themes. The ochre is used for
emphasis and borders, never as the only signal — anything colour communicates
also carries a word or a shape.

## The ledger — the structural identity

The previous pass changed the palette and nothing else, and that was the right
criticism of it: a warm ink and one ochre accent on the same rounded-card grid
every generated dashboard ships is a re-skin, not a design language. Palette is
the easiest thing to copy and the least of what makes a product recognisable.

So the identity is now in the **structure**, which survives any recolour.

Everything on these screens is one team filing reports — who did it, what it
was, when, and whether it is waiting on you. That is a ledger, and a ledger has
a shape that a card grid does not:

- **`.ledger`** — a square frame with a 2px accent rule across the head, the
  way a printed form is headed. No border radius anywhere. A radius puts it
  back in the card family, which is the family this is leaving.
- **`.ledger-head`** — the caption. Mono, small caps, what this column of facts
  is, and a zero-padded count on the right.
- **`.spine`** — the left rail. Two-letter initials in a square, joined by a
  continuous vertical hairline, so twelve entries read as one team's shift
  rather than twelve unrelated cards. It replaced the generated round avatars,
  which were twelve coloured circles carrying no information.
- **`.ref`** — the reference: `OTS-4B21`, mono, boxed, tabular. Derived from
  the agent's initials and the row's own id, so it is stable across screens and
  deploys with nothing to store. This is the piece that makes the product
  *speakable*: a founder can say "kill OTS-4B21" to the head agent instead of
  "the third one down", which has a different meaning every time something new
  arrives.
- **`.stamp`** — a verdict, squared and sitting on a double rule. The rounded
  status pill is the single most reliable tell of a generated interface; a
  stamp reads as something applied to a document by someone with the authority
  to apply it, which is exactly what "waiting on you" is.
- **`.ticked`** — registration marks at the corners instead of a radius, for
  the one block per screen that should read as an apparatus. Drawn with corner
  gradients rather than pseudo-elements, because `.ticked` sits on the same
  element as `.ledger` and a second `::before` silently replaces the head rule.

The test for any new surface: could this be recoloured and still be recognised
as this product? If the answer is no, the work went into the palette again.

## Curve and depth — the correction to the ledger pass

The ledger pass squared everything on the argument that a radius puts a surface
back in the card family. That was half right and it looked it. What makes these
screens a ledger is the ruled rows, the initials rail and the reference on every
line — none of which an outer corner radius touches. The squareness was doing no
work, and a flat rectangle with no elevation is itself the default of every
generated interface.

So the frame is soft and lifted and everything inside it stays hard.

- **Radii are named for what they sit on**, not for their size: `--r-control`,
  `--r-panel`, `--r-pill`. A button and the input beside it cannot drift apart.
- **Elevation is a ramp, and every layer is two shadows** — a tight contact
  shadow that says the edge is resting on something, and a wide soft one that
  says how far above. One shadow alone reads as a sticker; the contact shadow is
  what makes it an object.
- **Shadows are warm-tinted.** A neutral-black shadow over warm ink goes grey
  and muddy at the edges.
- **Light theme gets its own values, not the dark ones at lower alpha.** On
  paper a shadow reads as ink, so they are much tighter, and the lit inner top
  edge flips to a dark seated edge — a highlight on a light button is invisible,
  and leaving it in is exactly what makes light-mode controls look flat beside
  their dark-mode selves.
- **A raised control needs all three** or it still reads flat: a lit top edge
  and seated bottom edge for thickness, a contact plus cast shadow for resting
  on the page, and travel on press with the cast shadow collapsing as it goes
  down.
- **`overflow: hidden` on `.ledger` is load-bearing.** It clips the accent head
  rule and the row hover fills to the curve — the difference between a rounded
  box and a rounded box with square corners poking out of it.
- **The lift is the shadow, not the translate.** Two pixels of movement with a
  flat shadow reads as a jitter; the same movement with the shadow growing
  underneath reads as the card coming towards you.
- **Emphasis is elevation before it is colour.** The urgent lane is raised
  further off the page than its neighbours, because elevation is the signal the
  eye resolves before it reads anything.

Ghost and outline buttons deliberately carry no elevation: a page where
everything is raised has nothing raised.
