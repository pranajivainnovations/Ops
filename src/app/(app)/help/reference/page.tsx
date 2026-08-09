import Link from "next/link"

import { Bullets, Callout, Code, PageHeader, Section, SubSection, Table, Term } from "../_components/doc"

export const metadata = { title: "Handbook — Reference" }

export default function ReferencePage() {
  return (
    <>
      <PageHeader
        title="Reference"
        intro="Routes, limits, environment variables and known gaps. Look things up here rather than memorising them."
      />

      <Section title="Applications and ports">
        <Table
          head={["Application", "Local", "Production", "Project folder"]}
          rows={[
            ["Backend (Medusa v1.20.9)", <Term key="a">:9000</Term>, "13.62.195.167:9001", <Term key="b">Backend/Backend</Term>],
            ["CrossFriend Storefront", <Term key="c">:8000</Term>, "crossfriend.in", <Term key="d">CrossFriend-FrontStore</Term>],
            ["CrossFriend OPS", <Term key="e">:4000</Term>, "internal", <Term key="f">crossfriend-ops</Term>],
            ["Baker Portal", <Term key="g">:5000</Term>, "baker.crossfriend.in", <Term key="h">crossfriend-baker-portal</Term>],
            ["Pranajiva Storefront", "—", "separate", <Term key="i">Pranajiva-FrontStore</Term>],
          ]}
        />
      </Section>

      <Section title="Backend API">
        <SubSection title="Public — no authentication">
          <Table
            head={["Endpoint", "Purpose"]}
            rows={[
              [<Term key="a">GET /store/bakers</Term>, "Public baker directory, paginated and searchable"],
              [<Term key="b">GET /store/bakers/:slug</Term>, "One profile plus the ids of their published products"],
              [<Term key="c">GET /store/pincode/lookup</Term>, "City and state from a pincode"],
              [<Term key="d">GET /store/crossfriend/sales-channel</Term>, "The channel id the storefront must use"],
              [<Term key="e">GET /store/ai-studio/bakers</Term>, "Baker matching for a pincode"],
              [<Term key="f">POST /store/ai-studio/price</Term>, "Live cake price plus constraints"],
              [<Term key="g">POST /store/checkout/initialize</Term>, "Address, shipping and payment in one call"],
            ]}
          />
        </SubSection>

        <SubSection title="Baker — requires baker_session">
          <Table
            head={["Endpoint", "Purpose"]}
            rows={[
              [<Term key="a">POST /baker/auth/login</Term>, "Baker ID + password"],
              [<Term key="b">GET /baker/auth/activate</Term>, "Validate an invite without consuming it"],
              [<Term key="c">POST /baker/auth/activate</Term>, "Consume it and set a password"],
              [<Term key="d">GET /baker/me</Term>, "The signed-in baker and their counts"],
              [<Term key="e">GET/POST /baker/products</Term>, "List / create"],
              [<Term key="f">POST /baker/products/:id/state</Term>, "Publish, pause, archive"],
              [<Term key="g">GET /baker/categories</Term>, "Categories the form may offer"],
              [<Term key="h">POST /baker/uploads</Term>, "Signed S3 upload policy"],
            ]}
          />
        </SubSection>

        <SubSection title="OPS — requires the service key">
          <Table
            head={["Endpoint", "Purpose"]}
            rows={[[<Term key="a">POST /ops/bakers/:id/activation</Term>, "Issue or re-issue a baker invitation"]]}
          />
        </SubSection>
      </Section>

      <Section title="Limits and defaults">
        <Table
          head={["Thing", "Value"]}
          rows={[
            ["Activation link validity", "14 days, single use"],
            ["Baker session", "7 days"],
            ["OPS session", "7 days"],
            ["Baker password minimum", "10 characters"],
            ["Password hashing", "bcrypt, cost 12"],
            ["Product name", "120 characters"],
            ["Sizes per product", "8"],
            ["Price range", "above ₹0, at most ₹500,000"],
            ["Preparation time", "0–720 hours"],
            ["Photo formats", "JPEG, PNG, WEBP"],
            ["Photo size", "1 KB – 8 MB"],
            ["Upload signature validity", "5 minutes"],
            ["Marketplace page size", "24 products"],
            ["Database explorer sample", "20 rows"],
          ]}
        />
      </Section>

      <Section title="Environment variables">
        <Table
          head={["Variable", "Backend", "OPS", "Portal", "Storefront"]}
          rows={[
            [<Term key="a">DATABASE_URL</Term>, "✔", "✔", "—", "—"],
            [<Term key="b">REDIS_URL</Term>, "✔", "—", "—", "—"],
            [<Term key="c">JWT_SECRET</Term>, "✔", "—", "—", "—"],
            [<Term key="d">COOKIE_SECRET</Term>, "✔", "—", "—", "—"],
            [<Term key="e">BAKER_SESSION_SECRET</Term>, "✔", "—", "—", "—"],
            [<Term key="f">OPS_SERVICE_KEY</Term>, "✔", "✔", "—", "—"],
            [<Term key="g">SESSION_SECRET</Term>, "—", "✔", "—", "—"],
            [<Term key="h">MEDUSA_BACKEND_URL</Term>, "✔", "✔", "✔", "✔"],
            [<Term key="i">BAKER_PORTAL_URL</Term>, "—", "✔", "—", "—"],
            [<Term key="j">S3_*</Term>, "✔", "✔", "—", "—"],
            [<Term key="k">GOOGLE_PLACES_API_KEY</Term>, "—", "✔", "—", "—"],
          ]}
        />
        <p>
          Generate a secret with{" "}
          <Term>node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(48).toString(&apos;base64url&apos;))&quot;</Term>.
          Full setup instructions are in{" "}
          <Link href="/help/operations" className="text-slate-900 underline">
            Operations
          </Link>
          .
        </p>
      </Section>

      <Section title="Key database tables">
        <Table
          head={["Table", "What it holds"]}
          rows={[
            [<Term key="a">baker_network.bakers</Term>, "The bakery. Baker ID, slug, profile, is_public, is_active, badges"],
            [<Term key="b">baker_network.baker_users</Term>, "Login accounts. One active owner per bakery"],
            [<Term key="c">baker_network.baker_activations</Term>, "Invitations. Hashed tokens only"],
            [<Term key="d">baker_network.baker_products</Term>, <strong key="e">Authoritative product ownership + publication state</strong>],
            [<Term key="f">baker_network.baker_images</Term>, "Profile and banner images uploaded from OPS"],
            [<Term key="g">baker_network.baker_discoveries</Term>, "Raw Google Places results awaiting review"],
            [<Term key="h">baker_network.pincode_directory</Term>, "India Post data — 165,000+ rows"],
            [<Term key="i">baker_network.pincode_service_status</Term>, "Which pincodes are live"],
            [<Term key="j">baker_network.ops_users</Term>, "OPS logins"],
            [<Term key="k">public.product / product_variant</Term>, "Medusa products"],
            [<Term key="l">public.product_sales_channel</Term>, <strong key="m">What makes a product buyable</strong>],
          ]}
        />
      </Section>

      <Section title="Current limitations">
        <Callout tone="danger" title="OTP verification is mocked">
          <p>
            Any six-digit code signs a customer in. Anyone who knows a mobile number can access that
            customer&apos;s account and order history. <strong>This must be replaced with a real
            provider before the storefront is public</strong> — it is the most serious gap in the
            system.
          </p>
        </Callout>

        <Callout tone="warn" title="Bakers cannot edit products">
          <p>
            Create, publish, pause and archive only. A typo in a name or price means archiving and
            re-creating, and archiving is irreversible for the baker. Expect this to be the first
            thing bakers ask for.
          </p>
        </Callout>

        <Callout tone="warn" title="Blue tick criteria are undefined">
          <p>
            The flag exists, is stored, and displays on profiles and in the portal — but nothing
            grants it. It can only be set directly in the database today, and the criteria for
            awarding it have not been designed. It is deliberately separate from account claiming:
            claiming proves control, a blue tick attests to quality.
          </p>
        </Callout>

        <SubSection title="Other gaps">
          <Bullets
            items={[
              <>
                <strong>No baker order view.</strong> Bakers cannot see their orders in the portal.
                Orders live in Medusa and are assigned through OPS.
              </>,
              <>
                <strong>No OPS roles.</strong> Every OPS user can do everything.
              </>,
              <>
                <strong>One login per bakery.</strong> The schema supports staff accounts, but
                nothing creates them and login resolves to the single owner.
              </>,
              <>
                <strong>Baker profile editing is read-only in the portal.</strong> Bakers can see
                their details but not change them — profile edits go through OPS.
              </>,
              <>
                <strong>Newest-first only.</strong> The marketplace has no popularity or price
                sorting, because there is no order-count signal yet. The homepage section is
                honestly labelled &ldquo;Fresh from local bakers&rdquo; rather than &ldquo;Popular&rdquo;.
              </>,
              <>
                <strong>No geographic product filtering.</strong> The marketplace shows every
                published product regardless of the customer&apos;s pincode. Only AI Studio baker
                matching is pincode-aware.
              </>,
              <>
                <strong>Adding a category needs a code change</strong> — a migration plus updates in
                the backend and storefront.
              </>,
              <>
                <strong>Payment is pay-on-delivery.</strong> The manual provider; no gateway is
                wired up.
              </>,
            ]}
          />
        </SubSection>
      </Section>

      <Section title="Glossary">
        <Table
          head={["Term", "Means"]}
          rows={[
            ["Baker ID", <>Human-readable permanent identifier, <Term key="a">CFB-00042</Term>. The login username</>],
            ["Activation", "The one-time process where a baker sets their password and claims the account"],
            ["Claimed", "A bakery with an active login. Derived from baker_users, not stored as a flag"],
            ["Publication state", "CrossFriend's own product lifecycle — distinct from Medusa's status"],
            ["Sales channel", "Medusa's catalogue partition. Channel membership is what makes a product buyable"],
            ["Ready to Order", "The customer-facing name for the marketplace of pre-made baker products"],
            ["AI Cake Studio", "The custom-design journey — a different product, same cart"],
            ["Trust badge", "CrossFriend has confirmed the bakery is real and operating"],
            ["Blue tick", "Quality attestation, granted separately. Criteria not yet defined"],
          ]}
        />
      </Section>
    </>
  )
}
