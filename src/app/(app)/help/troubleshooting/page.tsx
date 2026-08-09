import Link from "next/link"

import { Callout, Code, PageHeader, Section, SubSection, Table, Term } from "../_components/doc"

export const metadata = { title: "Handbook — Troubleshooting" }

export default function TroubleshootingPage() {
  return (
    <>
      <PageHeader
        title="Troubleshooting"
        intro="Symptoms you are likely to hear from a baker or a customer, what usually causes them, and where to look. Most of these are configuration, not code."
      />

      <Section title="Baker cannot sign in">
        <Table
          head={["Symptom", "Likely cause", "Check"]}
          rows={[
            [
              "&ldquo;Baker ID or password is incorrect&rdquo;",
              "Wrong ID, wrong password, or they never activated",
              <>Open their baker page — if it says <strong key="a">Not invited</strong> or <strong key="b">Invited</strong>, they never set a password</>,
            ],
            [
              "&ldquo;This bakery account is currently inactive&rdquo;",
              <>Bakery has <Term key="c">is_active = false</Term></>,
              "Reactivate on the baker page",
            ],
            [
              "Login form submits and returns to the login page with no error",
              "The session cookie is being discarded",
              "The portal must be served over HTTPS in production — the cookie is marked Secure and a browser silently drops it over plain HTTP",
            ],
            [
              "Session drops immediately after signing in",
              <><Term key="d">BAKER_SESSION_SECRET</Term> changed, or differs between restarts</>,
              "Backend environment; a rotation signs everyone out",
            ],
          ]}
        />
      </Section>

      <Section title="Activation link problems">
        <Table
          head={["Symptom", "Cause", "What to do"]}
          rows={[
            [
              "&ldquo;This link doesn&rsquo;t work&rdquo;",
              "Expired (14 days), already used, or revoked by a newer invite",
              "Issue a new invite",
            ],
            [
              "Link points at localhost",
              <><Term key="a">BAKER_PORTAL_URL</Term> is wrong in OPS</>,
              "Fix it, restart OPS, re-issue the invite",
            ],
            [
              "&ldquo;Invite baker&rdquo; shows a configuration error",
              <>One of <Term key="b">MEDUSA_BACKEND_URL</Term>, <Term key="c">OPS_SERVICE_KEY</Term>, <Term key="d">BAKER_PORTAL_URL</Term> is unset</>,
              "The message names which one",
            ],
            [
              "&ldquo;Unauthorized&rdquo; when inviting",
              <><Term key="e">OPS_SERVICE_KEY</Term> does not match the backend&rsquo;s</>,
              "Compare both, restart both together",
            ],
            [
              "You lost the link before sending it",
              "It is only stored as a hash — unrecoverable by design",
              "Issue a new one",
            ],
          ]}
        />
      </Section>

      <Section title="Product published but not visible">
        <p>This is the most common report. Work down the list in order.</p>
        <Table
          head={["Check", "How", "Expected"]}
          rows={[
            [
              "Is it actually published?",
              "Baker&rsquo;s product list, or Database → baker_network → baker_products",
              <Term key="a">publication_state = published</Term>,
            ],
            [
              "Did Medusa status follow?",
              "Database → public → product",
              <Term key="b">status = published</Term>,
            ],
            [
              "Is it on the sales channel?",
              "Database → public → product_sales_channel",
              "A row pointing at the crossfriend channel",
            ],
            [
              "Does it have a price?",
              "Database → public → money_amount",
              "An INR amount for its variant",
            ],
            [
              "Does it have a product kind?",
              "Database → public → product",
              <><Term key="c">type_id</Term> not null — without it the product is invisible to every occasion page and to /store?type=</>,
            ],
          ]}
        />
        <Callout tone="warn" title="If status and channel disagree with publication_state">
          <p>
            Those three are written in one transaction, so they should never diverge. If they have,
            something changed the product outside the portal — most likely Medusa Admin. Toggling the
            product to Paused and back to Live in the portal re-applies all three correctly.
          </p>
        </Callout>
      </Section>

      <Section title="An occasion page is empty, or a type filter finds nothing">
        <p>
          Almost always one of three things. Work down in order — see{" "}
          <Link href="/help/taxonomy" className="text-slate-900 underline">Taxonomy</Link> for the
          full model.
        </p>
        <Table
          head={["Check", "How", "Expected"]}
          rows={[
            [
              "Is anything paired?",
              <>The <strong key="a">Storefront preview</strong> at the bottom of /taxonomy</>,
              <>The occasion lists its type sections. A red &ldquo;no sections&rdquo; warning means nothing is paired.</>,
            ],
            [
              "Do any products carry that type?",
              "Database → public → product",
              <><Term key="b">type_id</Term> matching the type. A paired type with no products renders no section — that is correct behaviour, not a bug.</>,
            ],
            [
              "Is the type or occasion retired?",
              "/taxonomy — retired rows are struck through",
              <>Both sides must be active. Retiring either hides every pairing that uses it.</>,
            ],
            [
              "Recently changed it?",
              "Wait, or POST /api/revalidate on the storefront",
              "The taxonomy is cached for 60 seconds.",
            ],
          ]}
        />
        <Callout tone="info" title="A newly added type is on no occasion">
          <p>
            Adding a product type does not put it anywhere. It is deliberately paired with nothing
            until someone ticks cells in the grid — otherwise a half-configured type would appear
            across the storefront the moment it was created.
          </p>
        </Callout>
      </Section>

      <Section title="A baker cannot publish a product">
        <p>
          The publish gate refuses incomplete listings and returns <Term>409</Term> with a message
          naming what is missing. This is working as intended, not an error.
        </p>
        <Table
          head={["Message says it needs", "Baker must"]}
          rows={[
            ["ingredients and allergens", "Tick the allergen boxes, or the explicit “none of the above”"],
            ["at least one photo", "Upload a photo — it becomes the thumbnail"],
            ["a description", "Write one"],
            ["what kind of product this is", <>Set the product kind. Listings created before that field existed have none — see <Link key="l" href="/help/taxonomy" className="text-slate-900 underline">Taxonomy</Link>.</>],
          ]}
        />
        <Callout tone="info" title="Why allergens are blocking">
          <p>
            CrossFriend sells food and allergen disclosure is an FSSAI obligation. This is the one
            field where an empty value is a safety problem rather than a quality one, so it is
            enforced by the system rather than requested by a reminder.
          </p>
        </Callout>
      </Section>

      <Section title="Customer cannot add something to the cart">
        <p>
          Almost always the sales channel. Medusa refuses a line item whose product is not on the
          cart&apos;s channel, and the error surfaces as a generic failure.
        </p>
        <Code>{`cart channel  must equal  product channel  =  crossfriend`}</Code>
        <Table
          head={["Check", "Where"]}
          rows={[
            [<>The product is on the <Term key="a">crossfriend</Term> channel</>, "Database → public → product_sales_channel"],
            [<>The backend resolves the channel: <Term key="b">/store/crossfriend/sales-channel</Term> returns an id, not null</>, "Backend"],
            ["The storefront can reach the backend", "Storefront logs"],
          ]}
        />
      </Section>

      <Section title="Baker profile or product missing from the storefront">
        <Table
          head={["Symptom", "Cause"]}
          rows={[
            [
              "Baker does not appear in /bakers",
              <>Needs BOTH <Term key="a">is_public</Term> and <Term key="b">is_active</Term>. New bakers default to not public</>,
            ],
            [
              "Baker profile 404s",
              "Same reason — a non-public profile returns 404 rather than 403, so nobody can probe which bakeries exist",
            ],
            [
              "Profile loads but shows no products",
              <>They have none in <Term key="c">published</Term> state</>,
            ],
            [
              "Wrong or missing baker name on a product card",
              <>Product metadata is written once at creation. Renaming a bakery does not rewrite existing products — cosmetic only, ownership is unaffected</>,
            ],
          ]}
        />
      </Section>

      <Section title="Photo upload fails">
        <Table
          head={["Symptom", "Cause"]}
          rows={[
            ["&ldquo;Photos must be a JPEG, PNG or WEBP image&rdquo;", "Unsupported format — HEIC from an iPhone is a common one"],
            ["&ldquo;Photos must be under 8MB&rdquo;", "Rejected before upload starts"],
            ["&ldquo;That photo was rejected — try a smaller one&rdquo;", "S3 rejected it. The real file exceeded the signed size policy"],
            ["&ldquo;Upload failed. Check your connection&rdquo;", "The browser could not reach S3 at all"],
            ["&ldquo;Couldn&rsquo;t prepare the upload&rdquo;", <>Backend S3 credentials — check <Term key="a">S3_*</Term> variables reached the container</>],
          ]}
        />
      </Section>

      <Section title="Everything feels slow">
        <p>
          Expected, and understood. Postgres is on Oracle Cloud while the backend is on AWS, so every
          query crosses the public internet — around 54 ms each, and Medusa issues dozens per
          request.
        </p>
        <p>
          Before investigating anything else, confirm it is not simply this: a page doing five
          backend calls will take a couple of seconds no matter how the code is written. Co-locating
          the database and backend is the fix, and needs no code change.
        </p>
      </Section>

      <Section title="Where to look">
        <Table
          head={["Question", "Look in"]}
          rows={[
            ["Any question about current data", <Link key="a" href="/database" className="font-semibold text-slate-900 underline">Database</Link>],
            ["Did the invite get issued?", <>Database → <Term key="b">baker_network.baker_activations</Term> — <Term key="c">used_at</Term> and <Term key="d">revoked_at</Term> tell the story</>],
            ["Has the baker claimed the account?", <>Database → <Term key="e">baker_network.baker_users</Term> — a row means yes</>],
            ["Who owns a product?", <>Database → <Term key="f">baker_network.baker_products</Term></>],
            ["Why is a price what it is?", <><Link key="g" href="/pricing/simulator" className="font-semibold text-slate-900 underline">Pricing → Simulator</Link></>],
            ["Backend errors", <>Container logs: <Term key="h">docker compose logs -f</Term></>],
          ]}
        />
        <SubSection title="A note on the Database explorer">
          <p>
            It is strictly read-only — the connection itself is opened in read-only mode, so Postgres
            refuses any write regardless of what is asked. Passwords, tokens and customer contact
            details are masked in sample rows. You cannot break anything by looking.
          </p>
        </SubSection>
      </Section>
    </>
  )
}
