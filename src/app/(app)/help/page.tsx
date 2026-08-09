import Link from "next/link"

import { Bullets, Callout, Code, PageHeader, Section, Table, Term } from "./_components/doc"
import { HELP_PAGES } from "./layout"

export const metadata = { title: "Handbook — Overview" }

export default function HelpOverviewPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        intro="CrossFriend is a celebration marketplace. Customers either design a custom cake with AI and have a local baker make it, or order something a baker has already listed. This handbook explains how the whole system fits together and how to operate it."
      />

      <Section title="The two customer journeys">
        <p>
          Everything in the product exists to serve one of two intents, and they converge on the
          same cart and checkout:
        </p>
        <Code>{`"I want something unique"        "I want something now"
        │                               │
   AI Cake Studio                  Ready to Order
   design → price → baker          browse → product → baker
        │                               │
        └───────────────┬───────────────┘
                        ▼
                  Cart → Checkout`}</Code>
        <p>
          There is exactly one cart and one checkout. Nothing in the baker marketplace created a
          second ordering path — a baker&apos;s product is an ordinary Medusa product and goes
          through the same flow a house-catalogue product always did.
        </p>
      </Section>

      <Section title="The four applications">
        <Table
          head={["Application", "Who uses it", "Port (local)", "Production"]}
          rows={[
            [
              <strong key="a">CrossFriend Storefront</strong>,
              "Customers",
              <Term key="b">:8000</Term>,
              "crossfriend.in",
            ],
            [
              <strong key="c">Baker Portal</strong>,
              "Bakery owners",
              <Term key="d">:5000</Term>,
              "baker.crossfriend.in",
            ],
            [
              <strong key="e">CrossFriend OPS</strong>,
              "Your team (this app)",
              <Term key="f">:4000</Term>,
              "internal",
            ],
            [
              <strong key="g">Backend (Medusa v1.20.9)</strong>,
              "Nothing directly — everything talks to it",
              <Term key="h">:9000</Term>,
              "13.62.195.167:9001",
            ],
          ]}
        />
        <p>
          A fifth application, the <strong>Pranajiva storefront</strong>, shares the same backend and
          database. It sells wellness products and is unrelated to CrossFriend, but because the two
          share infrastructure, several design decisions exist purely to keep them apart. Those are
          explained in <Link href="/help/architecture" className="text-slate-900 underline">Architecture</Link>.
        </p>
      </Section>

      <Section title="The complete flow, end to end">
        <p>
          This is the path from an unknown bakery on Google Maps to a customer receiving a cake.
          Every step is a real screen or endpoint you can go and look at.
        </p>
        <Code>{`  ┌─ OPS ────────────────────────────────────────────────────────┐
  │ 1. Google Places discovery finds a bakery                     │
  │ 2. Ops promotes it to a baker record → gets Baker ID CFB-000xx│
  │ 3. Ops clicks "Invite baker" → one-time activation link       │
  └───────────────────────────┬───────────────────────────────────┘
                              │  link sent by WhatsApp / email
  ┌─ BAKER PORTAL ────────────▼───────────────────────────────────┐
  │ 4. Baker opens link, sees their bakery name, sets a password  │
  │ 5. Baker signs in with Baker ID + password                    │
  │ 6. Baker adds a product: name, category, size(s), price, photo│
  │ 7. Baker clicks Publish                                       │
  └───────────────────────────┬───────────────────────────────────┘
                              │  product joins the crossfriend sales channel
  ┌─ STOREFRONT ──────────────▼───────────────────────────────────┐
  │ 8. Product appears in /ready-to-order, attributed to the baker│
  │ 9. Customer opens it, adds to cart                            │
  │ 10. Customer checks out through the existing checkout         │
  └───────────────────────────────────────────────────────────────┘`}</Code>

        <Callout tone="warn" title="Step 3 is the only manual gate">
          <p>
            There is no public baker registration. A bakery cannot sign itself up — someone on your
            team must invite it. That is deliberate: everything a baker publishes appears on the
            customer storefront under CrossFriend&apos;s name.
          </p>
        </Callout>
      </Section>

      <Section title="What is NOT built yet">
        <p>
          Read this before you promise anything to a baker. Full detail is in{" "}
          <Link href="/help/reference" className="text-slate-900 underline">
            Reference
          </Link>
          .
        </p>
        <Bullets
          items={[
            <>
              <strong>Bakers cannot edit a product after creating it.</strong> They can publish,
              pause and archive it, but not change the name, price or photo. A mistake means
              archiving and re-creating.
            </>,
            <>
              <strong>Customer OTP login is mocked.</strong> Any six-digit code signs a customer in.
              Fine while testing; not acceptable once the storefront is public.
            </>,
            <>
              <strong>Blue tick criteria are not defined.</strong> The flag exists and displays, but
              nothing grants it automatically.
            </>,
            <>
              <strong>No baker order management.</strong> Bakers cannot see orders in the portal.
              Orders live in Medusa and are assigned through OPS.
            </>,
          ]}
        />
      </Section>

      <Section title="How to read the rest of this handbook">
        <Table
          head={["Section", "Read it when"]}
          rows={HELP_PAGES.filter((p) => p.href !== "/help").map((p) => [
            <Link key={p.href} href={p.href} className="font-semibold text-slate-900 underline">
              {p.label}
            </Link>,
            p.blurb,
          ])}
        />
      </Section>
    </>
  )
}
