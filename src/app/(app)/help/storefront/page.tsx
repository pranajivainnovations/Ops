import Link from "next/link"

import { Bullets, Callout, Code, PageHeader, Section, SubSection, Table, Term } from "../_components/doc"

export const metadata = { title: "Handbook — Storefront" }

export default function StorefrontPage() {
  return (
    <>
      <PageHeader
        title="Storefront"
        intro="What customers see, how the two purchase journeys work, and how a baker's product becomes an order. Useful when a customer reports a problem and you need to know which part of the system to look at."
      />

      <Section title="The pages">
        <Table
          head={["Route", "What it is"]}
          rows={[
            [<Term key="a">/</Term>, "Homepage. Leads with the two intents: Ready to Order and AI Cake Studio, then recent products and local bakers"],
            [<Term key="b">/ready-to-order</Term>, "The marketplace — every published baker product"],
            [<Term key="c">/ready-to-order/cakes</Term>, "Category listing (also pastries, desserts, brownies, gifts, decor)"],
            [<Term key="d">/products/[handle]</Term>, "Product detail, with a 'From <baker>' block linking to their profile"],
            [<Term key="e">/bakers</Term>, "Public baker directory, searchable by name or city"],
            [<Term key="f">/bakers/[slug]</Term>, "One baker's profile and their published products"],
            [<Term key="g">/ai-cake-studio</Term>, "Design a custom cake"],
            [<Term key="h">/cart</Term>, <Term key="i">/checkout</Term>],
            [<Term key="j">/store</Term>, <>Old catalogue URL — permanently redirects to <Term key="k">/ready-to-order</Term></>],
          ]}
        />
      </Section>

      <Section title="Journey 1 — Ready to Order">
        <Code>{`Homepage → Ready to Order → product → add to cart → checkout → order`}</Code>
        <p>
          The straightforward path. Products shown here are baker products in{" "}
          <Term>published</Term> state; each card shows who baked it and links to their profile.
        </p>
        <p>
          Filtering by category happens in Postgres against an index, not in the browser, so the
          marketplace stays fast as the catalogue grows.
        </p>
      </Section>

      <Section title="Journey 2 — AI Cake Studio">
        <Code>{`Design → configure options → see price → choose a baker → cart → checkout`}</Code>
        <p>
          The customer describes a cake, the Studio generates designs, and they configure weight,
          tiers, shape, flavour and delivery options. Price is calculated live by the pricing engine
          you manage in{" "}
          <Link href="/pricing" className="text-slate-900 underline">
            Pricing
          </Link>
          , and impossible combinations are greyed out by the rules in{" "}
          <Link href="/constraints" className="text-slate-900 underline">
            Constraints
          </Link>
          .
        </p>
        <SubSection title="Baker selection">
          <p>
            The customer enters a pincode and either picks a baker or chooses{" "}
            <em>Order via CrossFriend</em>. The latter puts{" "}
            <Term>needsBakerAssignment: true</Term> on the line item, which is what surfaces it in{" "}
            <Link href="/bakers/assignments" className="text-slate-900 underline">
              Assignments
            </Link>
            .
          </p>
          <p>
            Which bakers appear is gated by <Term>pincode_service_status</Term> — a pincode with real
            bakers still shows &ldquo;coming soon&rdquo; until you enable it in{" "}
            <Link href="/pincodes" className="text-slate-900 underline">
              Pincodes
            </Link>
            .
          </p>
        </SubSection>
        <Callout tone="info" title="Custom cakes are invisible in the catalogue">
          <p>
            Each design becomes its own Medusa product in <Term>draft</Term> status, so it never
            appears in search or the marketplace. It exists only to be ordered by the customer who
            designed it.
          </p>
        </Callout>
      </Section>

      <Section title="Cart and checkout">
        <p>
          Both journeys converge here. There is one cart and one checkout — the baker marketplace
          added no second ordering path.
        </p>
        <Bullets
          items={[
            <>
              Carts are created on the <Term>crossfriend</Term> sales channel. This is not cosmetic:
              Medusa refuses a line item whose product is not on the cart&apos;s channel.
            </>,
            <>
              Checkout resolves address, shipping and payment in one backend call rather than the
              four round trips Medusa does by default.
            </>,
            <>
              Payment is the <Term>manual</Term> provider — effectively pay on delivery. No card
              processing is wired up.
            </>,
            <>
              For AI Studio orders the delivery pincode is locked to the one the cake was priced
              for, since changing it would invalidate the price the customer was shown.
            </>,
          ]}
        />
      </Section>

      <Section title="Address autofill">
        <p>
          Checkout fills City and State from the customer&apos;s pincode using{" "}
          <Term>baker_network.pincode_directory</Term> — the same India Post data used for baker
          matching. No external API is called.
        </p>
        <p>
          It also saves the address to the customer&apos;s address book on a successful checkout, so
          returning customers get a prefilled form. That only applies from their second order
          onward.
        </p>
      </Section>

      <Section title="Where the storefront gets its data">
        <Code>{`Storefront (server-side)
   │
   ├─ Medusa store API      products, cart, checkout, regions
   │     always with sales_channel_id = crossfriend
   │
   ├─ /store/bakers         directory + profiles      (never cached)
   ├─ /store/pincode/lookup city + state from pincode
   └─ /store/ai-studio/*    designs, pricing, constraints, baker matching`}</Code>
        <Callout tone="warn" title="Baker data is deliberately uncached">
          <p>
            The directory and profile pages are read fresh on every request. Caching them meant that
            after you published a bakery or a baker published a product, the page kept showing the
            old empty state for minutes with no way to tell why. One indexed query is the right price
            for a page whose whole job is to be an accurate shop window.
          </p>
        </Callout>
      </Section>

      <Section title="Customer accounts">
        <p>
          Customers sign in with a mobile number and a one-time code. An account is created silently
          on first use.
        </p>
        <Callout tone="danger" title="OTP verification is currently mocked">
          <p>
            <strong>Any six-digit code is accepted.</strong> Anyone who knows a mobile number can
            sign in as that customer. This is fine while testing and must be replaced with a real
            provider before the storefront is public — it is the single most important gap in the
            system today.
          </p>
        </Callout>
      </Section>
    </>
  )
}
