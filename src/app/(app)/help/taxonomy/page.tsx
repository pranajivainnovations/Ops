import Link from "next/link"

import { Bullets, Callout, Code, PageHeader, Section, SubSection, Table, Term } from "../_components/doc"

export const metadata = { title: "Handbook — Taxonomy" }

export default function TaxonomyPage() {
  return (
    <>
      <PageHeader
        title="Taxonomy"
        intro="Occasion × Product Type — the matrix that decides what appears on every occasion page and behind every type filter on the storefront. This is a CrossFriend concept, not a Medusa one, and it is edited at /taxonomy."
      />

      <Section title="The three axes, and why they are separate">
        <p>
          A product is described along three independent axes. Keeping them apart is the whole design;
          collapsing any two is what produced the mess this replaced.
        </p>
        <Table
          head={["Axis", "Question it answers", "Stored as", "How many per product"]}
          rows={[
            ["Product type", "What IS it?", <Term key="a">product.type_id</Term>, "Exactly one"],
            ["Occasion", "What is it FOR?", <Term key="b">product.collection_id</Term>, "One (the curated one)"],
            ["Category", "Which marketplace shelf?", <Term key="c">product_category</Term>, "Many"],
          ]}
        />
        <Callout title="Type is not Category">
          <strong>Type and Category are not the same thing and are not interchangeable.</strong>{" "}
          Category is the shelf a customer browses in Ready-to-Order. Type is what the product is,
          and it is the only thing occasion pages and <Term>/store?type=</Term> filter on. A product
          with a category but no type is invisible to both.
        </Callout>
      </Section>

      <Section title="The matrix">
        <p>
          The business rule is: <em>an occasion contains several product types, and a product type
          belongs to several occasions.</em> It is a relationship between two <strong>taxonomies</strong>,
          not a property of any product — roughly 25 rows in total, no matter how many products exist.
        </p>
        <Code>{`Birthday     →  Cakes · Decorations · Gifts
Anniversary  →  Cakes · Gifts · Premium/Wellness · Decorations
Festivals    →  Gifts · Premium/Wellness · Decorations · Cakes · Costumes
Kids Events  →  Costumes · Cakes · Decorations · Toys
Special      →  Gifts · Cakes · Decorations · Premium/Wellness · Toys · Costumes`}</Code>
        <p>
          Because the rule sits at the type level, <strong>a product needs no occasion data at all</strong>.
          A baker sets one field — &ldquo;this is a cake&rdquo; — and it appears on all five occasion
          pages automatically. Ten thousand baker products need ten thousand type assignments and
          zero occasion assignments.
        </p>
      </Section>

      <Section title="Where it lives">
        <p>
          Medusa v1 has no way to relate a product type to a collection — no table in{" "}
          <Term>public</Term> carries both a <Term>type_id</Term> and a <Term>collection_id</Term>{" "}
          except <Term>product</Term> itself, where they only meet on one product row. So the matrix
          lives in its own schema.
        </p>
        <Table
          head={["Table", "What it holds"]}
          rows={[
            [
              <Term key="a">crossfriend.product_types</Term>,
              <>Which Medusa types CrossFriend has adopted, plus label, emoji, order, <Term key="b">is_active</Term></>,
            ],
            [
              <Term key="c">crossfriend.occasions</Term>,
              <>Which Medusa collections are occasions, plus label, tagline, emoji, gradient, <Term key="d">is_active</Term></>,
            ],
            [
              <Term key="e">crossfriend.occasion_product_types</Term>,
              <>The matrix itself. Composite primary key <Term key="f">(collection_id, type_id)</Term></>,
            ],
          ]}
        />
        <SubSection title="Why the matrix points at our tables, not Medusa's">
          <p>
            The pairing table has foreign keys to <Term>crossfriend.product_types</Term> and{" "}
            <Term>crossfriend.occasions</Term>, not to Medusa&apos;s tables directly. Adoption is
            therefore a precondition: a Medusa type cannot enter the matrix until someone has
            deliberately added it as a CrossFriend type.
          </p>
          <Callout title="How Pranajiva stays out">
            This is what keeps Pranajiva out. The two brands share one Medusa install, so{" "}
            <Term>product_type</Term> contains Herbal Powder, SuperFood and face-pack alongside ours.
            Trying to pair one of those with an occasion fails on a foreign key — it is structurally
            impossible, not merely filtered.
          </Callout>
        </SubSection>
      </Section>

      <Section title="Using the page">
        <p>
          Everything is at <Link href="/taxonomy" className="text-slate-900 underline">Taxonomy</Link>{" "}
          under Catalogue.
        </p>
        <SubSection title="The grid">
          <p>
            Occasions run down the side, types across the top. Click a cell to pair or unpair. An
            amber cell is live; a grey cell is paired but hidden because one side is retired.
          </p>
          <p>
            The <strong>Storefront preview</strong> underneath shows exactly what each occasion page
            will render, including a red warning when an occasion has no types and its page would be
            empty. Read it before you leave the screen.
          </p>
        </SubSection>

        <SubSection title="Adding a product type">
          <p>
            Adding a type writes <strong>two</strong> rows: a Medusa <Term>product_type</Term> so
            products can be filed against it, and the CrossFriend registry row so it shows in
            navigation. If a Medusa type with that value already exists it is adopted rather than
            duplicated.
          </p>
          <Bullets
            items={[
              <>The machine value becomes part of a URL — <Term key="a">/store?type=bouquet</Term> — so it is slugified and should stay stable.</>,
              <>A new type is paired with <strong key="b">no occasion</strong> until you tick cells. It will not appear anywhere until you do.</>,
              <>Bakers can select it immediately. No deploy is needed — that was the point.</>,
            ]}
          />
        </SubSection>

        <SubSection title="Adding an occasion">
          <p>
            Same pattern: a Medusa collection tagged <Term>brand: crossfriend</Term>, plus the
            registry row. The URL handle becomes <Term>/occasions/&lt;handle&gt;</Term>.
          </p>
        </SubSection>

        <SubSection title="Retiring, not deleting">
          <p>
            &ldquo;Retire&rdquo; sets <Term>is_active = false</Term>. Nothing on this page deletes.
          </p>
          <Bullets
            items={[
              <>A retired type disappears from every occasion page and every filter at once.</>,
              <><strong key="a">Its pairings are kept.</strong> Bring it back and the matrix is exactly as you left it.</>,
              <>Deleting would cascade the pairings away, so a seasonal type brought back next year would have lost which occasions it belonged to.</>,
            ]}
          />
        </SubSection>
      </Section>

      <Section title="How a change reaches the storefront">
        <Code>{`OPS /taxonomy  ──▶  crossfriend.* tables
                         │
                         ▼
        GET /store/crossfriend/taxonomy      (backend, active rows only)
                         │
                         ▼
        Storefront @lib/data/taxonomy        (60-second cache)
                         │
        ┌────────────────┼────────────────────┐
        ▼                ▼                    ▼
   nav + mega-menu   /occasions/[slug]    /store?type=`}</Code>
        <Callout title="Changes take up to 60 seconds">
          An edit here appears on the storefront <strong>within 60 seconds</strong>, not instantly.
          To make it immediate, POST to the storefront&apos;s{" "}
          <Term>/api/revalidate</Term> with the revalidate secret.
        </Callout>
      </Section>

      <Section title="What this replaced, and why it matters">
        <p>
          The same relationship previously existed in four places at once, and they disagreed with
          each other and with the database:
        </p>
        <Table
          head={["Where", "What went wrong"]}
          rows={[
            ["TYPE_OCCASION_MAP (storefront code)", "The real rule, but required a deploy to change"],
            ["type-occasion-map.json (file on disk)", "Overrode the above, and silently discarded any key not on a hardcoded whitelist"],
            ["OCCASIONS[].sectionOrder (storefront code)", "Section ordering — disagreed with the map (listed Costumes on Birthday, which the map excluded)"],
            ["OCCASION_KITS (storefront code)", "A second hand-synced copy for quick-add kits"],
          ]}
        />
        <Callout title="The clearest symptom">
          The clearest symptom: the JSON contained a key{" "}
          <Term>&quot;Fancy-Dress&quot;</Term> that <strong>had never taken effect in its life</strong>.
          The loader validated keys against a frozen array that spells it <Term>costume</Term>, so the
          line was dropped and the hardcoded default used instead. Someone edited that file believing
          they had changed behaviour. A missing key in a JSON object is just <Term>undefined</Term> —
          it cannot fail loudly. A row with a foreign key can.
        </Callout>
        <p>
          The registries had also never been populated to match the config: of six configured product
          types only <Term>cake</Term> existed in the database, so five of six navigation chips
          filtered on a value no product could carry. That is why the model looked broken when it
          was actually just empty.
        </p>
      </Section>

      <Section title="If something looks wrong">
        <Table
          head={["Symptom", "Check"]}
          rows={[
            [
              "An occasion page is empty",
              <>Storefront preview on <Term key="a">/taxonomy</Term> — is anything paired? Then: do any products carry that type?</>,
            ],
            [
              "A type chip returns nothing",
              <>The type exists and is active, but no product has it. Check <Term key="b">product.type_id</Term>.</>,
            ],
            [
              "A change is not showing",
              "The 60-second cache. Wait, or call /api/revalidate.",
            ],
            [
              "A Pranajiva product appeared",
              <>Should be impossible via the matrix. Check the storefront query passes <Term key="c">sales_channel_id</Term>.</>,
            ],
            [
              "A new type shows nowhere",
              "Newly added types are paired with no occasion. Tick cells in the grid.",
            ],
          ]}
        />
      </Section>
    </>
  )
}
