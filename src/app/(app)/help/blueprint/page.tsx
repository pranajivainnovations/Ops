import Link from "next/link"

import { Bullets, Callout, Code, PageHeader, Section, SubSection, Table, Term } from "../_components/doc"

export const metadata = { title: "Handbook — Blueprint" }

/**
 * The whole-system chapter: business model and technology in one place.
 *
 * Deliberately separate from Architecture, which answers "what may each app do and how do they
 * talk". This one answers "what is this business, what is it built on, and how far along is it" —
 * the questions asked in a board meeting, an investor call or a technical interview, none of which
 * are served by a page about session cookies.
 *
 * Every number here was measured against the live database rather than estimated. Where something
 * is not decided yet it says so, because a blueprint that quietly fills gaps is worse than one with
 * visible holes — someone will quote it.
 */
export default function BlueprintPage() {
  return (
    <>
      <PageHeader
        title="Blueprint"
        intro="The business model and the technology in one place — what CrossFriend sells, how money and data move through it, what it is built on, and how far along it actually is. Written to be usable in a technical review and a business meeting without a second document."
      />

      <Section title="The business in one paragraph">
        <p>
          CrossFriend is a <strong>local celebration marketplace</strong>. Customers either design a
          custom cake by describing it to an AI and have a nearby baker make it for real, or order
          something a baker has already listed. Bakers are independent businesses onboarded by
          invitation. CrossFriend runs the storefront, the ordering, the payments and the support;
          the baker makes the food and holds the licence for it.
        </p>
        <Table
          head={["", "Who", "What they bring", "What they get"]}
          rows={[
            ["Customer", "Celebrating something", "Demand, payment", "A cake they could not have found or specified elsewhere"],
            ["Baker", "Independent local bakery", "Kitchen, skill, FSSAI licence", "Orders without building a storefront or marketing"],
            ["CrossFriend", "The platform", "Discovery, AI design tools, payments, trust", "Commission on completed orders"],
          ]}
        />
        <Callout title="Why this is a marketplace and not a shop">
          <p>
            CrossFriend never touches the food. That decision shapes everything downstream — the
            legal position (an intermediary under the IT Act), the liability model, the refund rules
            for perishables, and why allergen data is enforced by the platform but supplied by the
            baker. It is also what lets the business scale to a new city by signing bakeries rather
            than building kitchens.
          </p>
        </Callout>
      </Section>

      <Section title="The two revenue paths">
        <Code>{`AI CAKE STUDIO                          READY TO ORDER
"I want something unique"               "I want something now"
        │                                       │
  describe a cake                         browse listings
        │                                       │
  AI generates a design                   pick a size
        │                                       │
  price quoted by the                     price already set
  pricing + constraints engines           by the baker
        │                                       │
  a nearby baker accepts                  the baker who listed it
        │                                       │
        └───────────────┬───────────────────────┘
                        │
                 one Medusa cart
                 one checkout
                 one commission model`}</Code>
        <p>
          Both paths converge on the same commerce engine. That is deliberate: the Studio is a
          demand-generation and differentiation layer, not a separate business. A design becomes an
          ordinary Medusa product with variants and prices, and follows the ordinary cart and
          checkout.
        </p>
        <Table
          head={["", "AI Cake Studio", "Ready to Order"]}
          rows={[
            ["Customer intent", "Unique, occasion-specific", "Convenient, immediate"],
            ["Price set by", "Pricing engine (attributes × region)", "The baker, per size"],
            ["Lead time", "Longer — bespoke work", "Baker's stated prep time"],
            ["Strategic role", "Differentiation, acquisition", "Repeat volume, retention"],
            ["Product status in Medusa", <Term key="a">draft</Term>, <Term key="b">published</Term>],
          ]}
        />
        <Callout tone="warn" title="Commission is not yet set">
          <p>
            The commission rate is agreed with each baker at onboarding and is currently a placeholder
            in the Baker Terms. Until it is decided, unit economics cannot be modelled — this is the
            single biggest open business input.
          </p>
        </Callout>
      </Section>

      <Section title="What is actually differentiated">
        <p>Stated plainly, because it is the question every outside party asks.</p>
        <Table
          head={["Asset", "Why it is defensible", "Honest caveat"]}
          rows={[
            [
              "AI Cake Studio",
              "Real generation pipeline — prompt elaboration, image generation, pricing and constraints engines. 45 designs made so far, 44 shared publicly.",
              "The models are third-party. The moat is the pipeline, the pricing integration and the baker network that can actually make the output — not the image generation itself.",
            ],
            [
              "Baker network",
              "Invite-only, verified, with permanent Baker IDs and a self-service portal. Supply is the hard side of this marketplace.",
              "1 baker onboarded. This is the number that matters most and it is currently 1.",
            ],
            [
              "Community gallery",
              "44 public designs with real prompts — proof, inspiration, and SEO surface that competitors cannot copy.",
              "Not yet indexed; SEO work is outstanding.",
            ],
            [
              "Local-first model",
              "Fresh food cannot ship intercity. Serving an area requires local supply, which is a barrier to a national entrant.",
              "It is equally a barrier to us. Each city is a separate supply build.",
            ],
          ]}
        />
      </Section>

      <Section title="The technology stack">
        <Table
          head={["Layer", "Technology", "Version", "Notes"]}
          rows={[
            ["Commerce engine", "Medusa", "1.20.9", "Headless. Products, carts, orders, regions, sales channels"],
            ["Database", "PostgreSQL", "—", "7 schemas, 102 migrations applied"],
            ["Cache / event bus", "Redis", "—", "Medusa cache + BullMQ event queue"],
            ["Storefront", "Next.js / React", "14 / 18", "App Router, server components, Tailwind 3"],
            ["OPS", "Next.js / React", "16.2 / 19.2", "Server actions, direct SQL, Tailwind 4"],
            ["Baker Portal", "Next.js / React", "16.2 / 19.2", "Mobile-first, no direct DB access"],
            ["Object storage", "AWS S3", "—", "Product photos, baker images, AI designs"],
            ["AI providers", "Replicate / OpenAI / Anthropic", "—", "Image generation + prompt elaboration"],
            ["Auth", "jose (JWT HS256) + bcrypt", "—", "Three cryptographically separate identities"],
          ]}
        />
        <SubSection title="Why Medusa rather than a custom build">
          <p>
            Carts, inventory, regions, tax, discounts and order state machines are solved problems
            with a long tail of correctness bugs. Medusa provides them, and CrossFriend&apos;s own
            concepts — bakers, publication state, pricing rules, the taxonomy — live in separate
            Postgres schemas alongside rather than as forks of it. Upgrading Medusa does not touch
            them.
          </p>
        </SubSection>
      </Section>

      <Section title="Deployment topology — and its cost">
        <Code>{`  AWS                                ORACLE CLOUD
  ┌────────────────────────┐         ┌────────────────────────┐
  │  Medusa backend        │◀───────▶│  PostgreSQL            │
  │  Pranajiva storefront  │  54ms   │  Redis                 │
  │  CrossFriend OPS       │  each   │  CrossFriend storefront│
  └────────────────────────┘  hop    └────────────────────────┘`}</Code>
        <Callout tone="warn" title="This split is the dominant performance problem">
          <p>
            Compute and data sit on different clouds. Every database round trip costs ~54 ms, and a
            checkout makes many of them — a <strong>33-second checkout</strong> was measured. No
            amount of query tuning fixes a topology problem; co-locating compute with data does.
          </p>
          <p className="mt-2">
            The same split causes the local backend to be killed by NAT reaping an idle Redis
            connection. The deployed backend does not have this problem — it has held the same
            connection for 23 hours.
          </p>
        </Callout>
        <p>
          Shared with the Pranajiva wellness brand: one Medusa install, one database, one Redis.
          Separation is by <strong>sales channel</strong> — see{" "}
          <Link href="/help/architecture" className="text-slate-900 underline">Architecture</Link>.
        </p>
      </Section>

      <Section title="The four applications">
        <Code>{`                    ┌──────────────────────────────┐
                    │   PostgreSQL  ·  Redis  ·  S3 │
                    └───────────▲──────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │   Medusa backend      │  commerce + custom APIs
                    └───┬────────┬───────┬──┘
          /store/*      │        │       │      /baker/*
        ┌───────────────┘        │       └──────────────┐
        │                        │ direct SQL           │
  ┌─────▼─────┐          ┌───────▼──────┐        ┌──────▼──────┐
  │ Storefront│          │     OPS      │        │ Baker Portal│
  │   :8000   │          │    :4000     │        │    :5000    │
  │ customers │          │  our team    │        │   bakers    │
  └───────────┘          └──────────────┘        └─────────────┘`}</Code>
        <Table
          head={["App", "Audience", "Database access", "Identity"]}
          rows={[
            ["Storefront", "Customers", "None — via backend API", <Term key="a">_medusa_jwt</Term>],
            ["OPS", "Internal team", <strong key="b">Direct SQL</strong>, <Term key="c">ops_session</Term>],
            ["Baker Portal", "Bakers", "None — via backend API", <Term key="d">baker_session</Term>],
            ["Medusa Admin", "Internal (rarely)", "Direct (its own ORM)", "Medusa user"],
          ]}
        />
        <Callout title="Three separate identities, on purpose">
          <p>
            A customer token, an ops token and a baker token are signed with different secrets and
            cannot be interchanged. A compromised customer session cannot reach OPS; a baker cannot
            reach another bakery&apos;s data. The Baker Portal holds no database credentials at all,
            so &ldquo;the backend decides authorization&rdquo; is enforceable rather than aspirational.
          </p>
        </Callout>
      </Section>

      <Section title="How an order actually flows">
        <Code>{`CUSTOMER              STOREFRONT         BACKEND            BAKER
   │                      │                 │                 │
   │  browse ────────────▶│                 │                 │
   │                      │─ products ─────▶│                 │
   │                      │   (filtered by sales channel)     │
   │  add to cart ───────▶│─ cart ─────────▶│                 │
   │  checkout ──────────▶│─ order ────────▶│                 │
   │                      │                 │─ notify ───────▶│  ⚠ not built
   │                      │                 │                 │
   │                      │                 │◀─ accept ───────│
   │                      │                 │                 │  bakes
   │◀─ delivered ─────────┴─────────────────┴─────────────────┘`}</Code>
        <Bullets
          items={[
            <>Products are only visible when <strong key="a">published AND on the crossfriend sales channel</strong> — two independent gates.</>,
            <>Channel membership is literally what makes something buyable: Medusa refuses a line item whose product is not on the cart&apos;s channel.</>,
            <>Ownership is decided by <Term key="b">baker_network.baker_products</Term>, never by product metadata.</>,
            <><strong key="c">Baker notification on a new order is not built.</strong> Nor is customer order confirmation.</>,
          ]}
        />
      </Section>

      <Section title="The data model at a glance">
        <Table
          head={["Schema", "Owns", "Why separate"]}
          rows={[
            [<Term key="a">public</Term>, "Medusa — products, carts, orders, regions, channels", "Upstream. We add to it, we do not fork it"],
            [<Term key="b">baker_network</Term>, "Bakers, users, invitations, product ownership, pincodes", "CrossFriend's operational domain"],
            [<Term key="c">crossfriend</Term>, "Occasion × Product Type taxonomy", <>A relationship Medusa cannot express — see <Link key="l" href="/help/taxonomy" className="text-slate-900 underline">Taxonomy</Link></>],
            [<Term key="d">pricing</Term>, "AI Studio pricing rules, attributes, regions", "Versioned rule sets, published atomically"],
            [<Term key="e">constraints</Term>, "Which cake configurations are valid", "Same versioning model as pricing"],
            [<Term key="f">ai_studio</Term>, "Generated designs, likes, comments", "Not Medusa products — designs are content"],
          ]}
        />
        <p>
          32 tables across the CrossFriend schemas, 102 migrations applied. Everything CrossFriend-
          specific is additive — a Medusa upgrade touches none of it.
        </p>
      </Section>

      <Section title="Where the system stands — measured, not estimated">
        <Table
          head={["Capability", "State"]}
          rows={[
            ["Catalogue, taxonomy, navigation", <strong key="a">Working</strong>],
            ["Baker onboarding — invite → activate → list → publish", <strong key="b">Working</strong>],
            ["AI Cake Studio — generation, pricing, constraints", <strong key="c">Working</strong>],
            ["OPS — bakers, taxonomy, pricing, pincodes, database explorer", <strong key="d">Working</strong>],
            ["Legal documents", <strong key="e">Written</strong>, ],
            ["Cart and checkout", "Working — but see payments"],
            ["Payments", <strong key="f">Not built</strong>],
            ["Customer authentication", <strong key="g">Mocked</strong>],
            ["Order notifications", <strong key="h">Not built</strong>],
            ["SEO — sitemap, structured data", <strong key="i">Not built</strong>],
            ["Search", "Deferred by decision"],
          ]}
        />
        <Callout tone="warn" title="Two blockers, each absolute">
          <p>
            <strong>Payments:</strong> only <Term>medusa-payment-manual</Term> is registered. Orders
            complete with no money moving.
            <br />
            <strong>Customer OTP:</strong> any 6-digit code is currently accepted. This is an
            account-takeover path, not an incomplete feature.
          </p>
          <p className="mt-2">
            Both are known and in progress. Neither is architectural — they are integrations, not
            redesigns. Everything else can be demonstrated today.
          </p>
        </Callout>
      </Section>

      <Section title="Numbers, as of this handbook">
        <Table
          head={["Metric", "Value", "What it means"]}
          rows={[
            ["Bakers onboarded", "1", "The supply side. This is the number that gates growth"],
            ["Live products", "1", "Follows directly from the above"],
            ["AI designs generated", "45 (44 public)", "Real usage of the Studio before launch"],
            ["Pincodes in directory", "165,627", "All-India reference data, loaded"],
            [<strong key="p">Pincodes service-enabled</strong>, <strong key="v">2</strong>, "Deliberate — serviceability is switched on per area as supply arrives"],
            ["Product types / occasions", "6 / 5", "22 pairings in the taxonomy matrix"],
            ["Database migrations", "102", "Schema is versioned and reproducible"],
          ]}
        />
        <Callout title="Read the 1 baker honestly">
          <p>
            The platform is built well ahead of its supply, which is the correct order for a
            marketplace with a heavy technical component — but it means the current constraint is
            commercial, not engineering. The next meaningful milestone is bakers onboarded and
            pincodes switched on, not features shipped.
          </p>
        </Callout>
      </Section>

      <Section title="Scale — what it holds, and where it bends first">
        <Table
          head={["Dimension", "Current design", "First thing to break"]}
          rows={[
            ["Products", "Filtered server-side by channel, category and type against indexed relations", "Nothing near-term. The JS-filtering that would have broken has been removed"],
            ["Taxonomy", "~25 rows regardless of catalogue size", "Never. It scales by construction"],
            ["Bakers", "One portal session each, isolated by query", "Ops workload before the system"],
            ["Search", "Not enabled", "Needs MeiliSearch plus an indexing pipeline before it can launch"],
            ["Sorting by price", "In memory, over a 100-row window", "A category with more than 100 products will sort incorrectly"],
            ["Checkout latency", "~54 ms per DB hop, cross-cloud", <strong key="a">Already bent — 33 s measured</strong>],
          ]}
        />
      </Section>

      <Section title="If you are presenting this">
        <Bullets
          items={[
            <><strong key="a">The story:</strong> local bakers cannot be found online and cannot build storefronts; customers cannot specify what they actually want. CrossFriend solves both ends with one platform.</>,
            <><strong key="b">The differentiator:</strong> describe a cake in words, see it, and have someone near you make it. Show the community gallery — the real prompts are more convincing than any slide.</>,
            <><strong key="c">The technical claim:</strong> built on a proven commerce engine, with CrossFriend&apos;s own domain in separate schemas. Not a prototype, and not a fork.</>,
            <><strong key="d">The honest position:</strong> the platform is ahead of its supply, and payments and auth are integrations in progress. Say it before you are asked.</>,
          ]}
        />
      </Section>
    </>
  )
}
