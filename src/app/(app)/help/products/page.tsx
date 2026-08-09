import Link from "next/link"

import { Bullets, Callout, Code, PageHeader, Section, SubSection, Table, Term } from "../_components/doc"

export const metadata = { title: "Handbook — Products" }

export default function ProductsPage() {
  return (
    <>
      <PageHeader
        title="Products"
        intro="How a baker's product is created, what it becomes inside Medusa, and exactly what makes it visible and buyable. This is the most mechanically intricate part of the system."
      />

      <Section title="What a baker fills in">
        <p>
          Some fields are required to <strong>save</strong>, and more are required to{" "}
          <strong>publish</strong>. The split is deliberate: a baker should be able to save a
          half-finished listing and come back to it, but an incomplete listing must never reach a
          customer.
        </p>
        <Table
          head={["Field", "Needed to", "Becomes"]}
          rows={[
            ["Product name", "Save", <>Medusa <Term key="a">title</Term> + a generated <Term key="b">handle</Term></>],
            ["Category", "Save", "A Ready-to-Order product category (the marketplace shelf)"],
            [
              <><strong key="t">Product kind</strong></>,
              "Save",
              <>Medusa <Term key="c">type_id</Term> — see <Link key="l" href="/help/taxonomy" className="text-slate-900 underline">Taxonomy</Link></>,
            ],
            ["At least one size + price", "Save", "One Medusa variant per size, priced in INR"],
            [
              <><strong key="i">Ingredients &amp; allergens</strong></>,
              <strong key="p">Publish</strong>,
              <Term key="d">metadata.contains[]</Term>,
            ],
            ["Description", <strong key="p2">Publish</strong>, <Term key="e">description</Term>],
            ["Photo", <strong key="p3">Publish</strong>, <>S3 upload → <Term key="f">thumbnail</Term> + <Term key="g">images[0]</Term></>],
            ["Preparation time", "Optional", <Term key="h">metadata.prep_hours</Term>],
            ["Who it&apos;s for / highlights / care note", "Optional", <>Normalised arrays in <Term key="j">metadata</Term></>],
          ]}
        />
        <Callout title="Kind is not Category">
          <strong>Product kind is not the same as Category.</strong> Category is the shelf. Kind is
          the taxonomy axis that decides which occasion pages the product appears on and what{" "}
          <Term>/store?type=</Term> finds. A product created before this field existed has no kind and
          is invisible to both — and cannot be published until one is set.
        </Callout>
        <p>
          The baker never sees a variant ID, handle, sales channel, region, currency, status or
          shipping profile. All of it is derived server-side. If a baker ever reports seeing Medusa
          vocabulary, that is a bug.
        </p>

        <SubSection title="Ingredients and allergens are a compliance field">
          <p>
            The platform refuses to publish a listing with no ingredient information. This is not a
            quality nicety — CrossFriend sells food, allergen disclosure is an FSSAI obligation, and
            &ldquo;the baker left it blank&rdquo; is not a defence.
          </p>
          <p>
            The form offers the common allergens as checkboxes plus a free-text field, and an explicit{" "}
            <em>&ldquo;none of the above&rdquo;</em> option — without that, &ldquo;contains no
            allergens&rdquo; and &ldquo;hasn&apos;t filled it in&rdquo; would look identical to the
            gate and an allergen-free product could never go live.
          </p>
        </SubSection>

        <SubSection title="Metadata is built, never accepted">
          <p>
            Nothing writes product <Term>metadata</Term> directly. Every creation path goes through{" "}
            <Term>buildBakerProductMetadata()</Term>, which emits a fixed set of keys and coerces
            types — a comma-separated string becomes a trimmed, de-duplicated array every time.
          </p>
          <Callout title="Why this is enforced">
            This exists because of a real failure in this database. Pranajiva&apos;s two products
            carry the same metadata keys in two different shapes — <Term>pair_with</Term> is a proper
            array on one and the string{" "}
            <Term>&quot;\&quot;a\&quot;,      \&quot;b\&quot;&quot;</Term> on the other, because
            someone pasted the inside of a JSON array into Medusa Admin&apos;s free-text metadata box.
            Four of seven fields are corrupted that way. Ops-only fields (<Term>is_addon</Term>,{" "}
            <Term>kit_eligible</Term>, <Term>seo_title</Term>) are absent by construction — a baker
            payload containing them cannot smuggle them through.
          </Callout>
        </SubSection>

        <SubSection title="SEO is generated, not written">
          <p>
            <Term>seo_title</Term> and <Term>seo_description</Term> are generated at creation from the
            product name, baker and city — <em>&ldquo;Chocolate Truffle Cake by Butter Berry |
            CrossFriend&rdquo;</em>. Nobody writes 4,000 of these by hand. Ops reviews exceptions
            rather than authoring the set.
          </p>
        </SubSection>

        <SubSection title="Limits">
          <Bullets
            items={[
              <>Name: 120 characters</>,
              <>Up to 8 sizes, each with a distinct label</>,
              <>Price: above ₹0 and at most ₹500,000</>,
              <>Preparation time: 0–720 hours</>,
              <>Photos: JPEG, PNG or WEBP, between 1 KB and 8 MB</>,
            ]}
          />
        </SubSection>
      </Section>

      <Section title="The publication lifecycle">
        <p>
          CrossFriend keeps its own lifecycle on <Term>baker_products.publication_state</Term>. It is
          deliberately <em>not</em> Medusa&apos;s product status.
        </p>
        <Code>{`   draft ──────────▶ published ──────▶ unavailable
     │                  │          ◀──────┘
     │                  │                 │
     └──────────────────┴─────────────────┴──▶ archived  (terminal)`}</Code>
        <Table
          head={["State", "Baker sees", "Meaning"]}
          rows={[
            [<Term key="a">draft</Term>, <strong key="b">Not listed</strong>, "Created, never been live"],
            [<Term key="c">published</Term>, <strong key="d">Live</strong>, "On sale in the marketplace"],
            [<Term key="e">unavailable</Term>, <strong key="f">Paused</strong>, "Temporarily off sale — holiday, sold out"],
            [<Term key="g">archived</Term>, <strong key="h">Archived</strong>, "Permanently retired"],
          ]}
        />
        <Callout tone="warn" title="Archived is terminal for a baker">
          <p>
            A baker can always retire a listing but cannot resurrect one. Bringing something back is
            an ops action, because a product may have been archived for a reason that outlives the
            baker&apos;s memory of it.
          </p>
        </Callout>
      </Section>

      <Section title="The publish gate">
        <p>
          Going live is refused unless the listing is complete. The check runs{" "}
          <strong>inside the publish transaction</strong>, after the ownership row is locked, so it
          reflects the product as it is at that moment rather than as it was when the page rendered.
        </p>
        <Table
          head={["Missing", "Baker sees"]}
          rows={[
            ["Ingredients / allergens", <>&ldquo;Before this can go live it needs ingredients and allergens.&rdquo;</>],
            ["A photo", <>&ldquo;Before this can go live it needs at least one photo.&rdquo;</>],
            ["A description", <>&ldquo;…it needs a description.&rdquo;</>],
            ["A product kind", <>&ldquo;…it needs what kind of product this is.&rdquo;</>],
            ["Several at once", <>They are combined into one readable sentence.</>],
          ]}
        />
        <Callout title="Refusals return 409">
          Refusals return <Term>409</Term>, matching the existing convention for a rejected state
          transition — not <Term>400</Term>. If you are reading logs, a 409 on{" "}
          <Term>/baker/products/:id/state</Term> is the gate working, not an error.
        </Callout>
        <p>
          Products created before the product-kind field existed are blocked from publishing until a
          kind is set. Publishing one would put it on the sales channel while leaving it invisible to
          every occasion page and type filter — live but unfindable, which is worse than blocked.
        </p>
      </Section>

      <Section title="What publishing actually does">
        <p>
          Publication state is projected onto <strong>two</strong> Medusa-side facts, and both move
          together inside one transaction:
        </p>
        <Table
          head={["publication_state", "Medusa status", "crossfriend sales channel"]}
          rows={[
            [<Term key="a">published</Term>, <Term key="b">published</Term>, <strong key="c">member</strong>],
            [<Term key="d">draft</Term>, <Term key="e">proposed</Term>, "not a member"],
            [<Term key="f">unavailable</Term>, <Term key="g">proposed</Term>, "not a member"],
            [<Term key="h">archived</Term>, <Term key="i">proposed</Term>, "not a member"],
          ]}
        />
        <p>Two independent gates, on purpose:</p>
        <Bullets
          items={[
            <>
              <Term>status</Term> keeps an unpublished product out of the store API entirely — it
              only ever returns <Term>published</Term> products.
            </>,
            <>
              <strong>Channel membership is what makes something buyable.</strong> Medusa refuses a
              line item whose product is not on the cart&apos;s sales channel. So joining the channel
              is literally the act of going on sale, and leaving it is the act of coming off.
            </>,
          ]}
        />
        <Callout tone="info" title="Why 'proposed' and not 'draft'">
          <p>
            The AI Cake Studio already uses Medusa <Term>draft</Term> to mean &ldquo;bespoke cake,
            must never appear in a catalogue&rdquo;. Reusing it would make two very different states
            indistinguishable — a cleanup script could not tell a baker&apos;s unfinished listing
            from a customer&apos;s personalised order. <Term>proposed</Term> is a valid Medusa status
            that nothing else in this installation uses.
          </p>
        </Callout>
      </Section>

      <Section title="Ownership">
        <p>
          <Term>baker_network.baker_products</Term> is the single authority on who owns a product.
          The <Term>medusa_product_id</Term> column is unique on its own, so{" "}
          <strong>one product has exactly one owner</strong>.
        </p>
        <p>
          Every baker-scoped read and write joins through that table using the baker id resolved from
          the session cookie. A baker can put any product id in a URL and it will still only work if
          they own it. A product owned by someone else returns <Term>404</Term>, not{" "}
          <Term>403</Term> — being told &ldquo;you may not touch this&rdquo; would confirm the id
          exists.
        </p>
        <p>
          The product and its ownership row are written in <strong>one transaction</strong>. If the
          ownership insert fails, the Medusa product rolls back with it — an unowned product would be
          worse than none, since nothing would ever claim or clean it up.
        </p>
      </Section>

      <Section title="Product photos">
        <p>
          Photos are uploaded <strong>straight from the baker&apos;s browser to S3</strong>. The
          bytes never pass through the backend — its request body limit is around 100 KB, so no photo
          would fit.
        </p>
        <p>
          The backend issues a short-lived signed policy that S3 itself enforces: exact destination
          key, exact content type, and a size range. A baker cannot upload to another bakery&apos;s
          folder even by hand-crafting the request, and cannot exceed 8 MB by lying about the size.
        </p>
        <Code>{`pranajiva-innovations/
└── bakers-images/{bakerId}/
    ├── profile_{uuid}.jpg      ← uploaded from OPS
    ├── banner_{uuid}.jpg       ← uploaded from OPS
    └── products/{uuid}.jpg     ← uploaded from the Baker Portal`}</Code>
        <p>
          Everything belonging to one bakery lives under one prefix, so it is traceable in the S3
          console and deletable as a unit if a bakery leaves.
        </p>
      </Section>

      <Section title="Categories">
        <p>
          Products are filed under the Ready-to-Order category tree, created by a database migration:
        </p>
        <Code>{`Ready to Order
├── Cakes        /ready-to-order/cakes
├── Pastries     /ready-to-order/pastries
├── Desserts     /ready-to-order/desserts
├── Brownies     /ready-to-order/brownies
├── Gifts        /ready-to-order/gifts
└── Decor        /ready-to-order/decor`}</Code>
        <p>
          The portal fetches this list from the backend rather than hardcoding it, so the form can
          only offer categories the API will accept. Adding a category means a migration plus adding
          it to the backend&apos;s category list and the storefront&apos;s route list — it is not yet
          a purely data-driven change.
        </p>
      </Section>

      <Section title="Bakers cannot edit products">
        <Callout tone="danger" title="This will come up">
          <p>
            There is no edit screen. A baker who mistypes a price or name can only{" "}
            <strong>archive the product and create a new one</strong>. Archiving is irreversible for
            them, so the old listing stays visible in their list as Archived.
          </p>
          <p>
            If a baker asks you to fix something, the options today are: talk them through
            re-creating it, or change it directly in Medusa Admin. Editing is the most requested
            missing feature and the obvious next thing to build.
          </p>
        </Callout>
      </Section>

      <Section title="AI Studio products are different">
        <p>
          The AI Cake Studio also creates Medusa products, one per customer design. They are not
          baker products and never appear in the marketplace:
        </p>
        <Table
          head={["", "Baker product", "AI Studio product"]}
          rows={[
            ["Created by", "A baker, in the portal", "A customer, by designing a cake"],
            ["Medusa status", <>proposed → published</>, <>always <Term key="a">draft</Term></>],
            ["Ownership row", <>yes, in <Term key="b">baker_products</Term></>, "none"],
            ["In the marketplace", "when published", <strong key="c">never</strong>],
            ["Sales channel", "crossfriend, when published", "crossfriend, always"],
          ]}
        />
        <p>
          Both live on the same sales channel because both must be addable to a CrossFriend cart.
          What keeps AI Studio cakes out of the catalogue is their Medusa status — the store API
          only returns <Term>published</Term> products, and they are permanently{" "}
          <Term>draft</Term>.
        </p>
        <p>
          More on the customer side of this in{" "}
          <Link href="/help/storefront" className="text-slate-900 underline">
            Storefront
          </Link>
          .
        </p>
      </Section>
    </>
  )
}
