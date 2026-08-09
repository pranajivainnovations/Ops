import Link from "next/link"

import { Bullets, Callout, Code, PageHeader, Section, SubSection, Table, Term } from "../_components/doc"

export const metadata = { title: "Handbook — Architecture" }

export default function ArchitecturePage() {
  return (
    <>
      <PageHeader
        title="Architecture"
        intro="Four applications, one backend, one database. This page explains what each app is allowed to do, how they talk to each other, and why the boundaries are drawn where they are."
      />

      <Section title="The shape of the system">
        <Code>{`  CUSTOMER                 BAKER                    YOUR TEAM
  _medusa_jwt           baker_session             ops_session
      │                      │                         │
      ▼                      ▼                         ▼
┌──────────────┐    ┌──────────────┐         ┌──────────────┐
│ CrossFriend  │    │ Baker Portal │         │ CrossFriend  │
│ Storefront   │    │              │         │ OPS          │
│ :8000        │    │ :5000        │         │ :4000        │
└──────┬───────┘    └──────┬───────┘         └───┬──────┬───┘
       │                   │                     │      │
       │  HTTP             │  HTTP               │HTTP  │ direct SQL
       └───────────┬───────┴─────────────────────┘      │
                   ▼                                    │
         ┌───────────────────────┐                      │
         │ Backend — Medusa      │                      │
         │ :9000                 │                      │
         └───────────┬───────────┘                      │
                     ▼                                  │
         ┌───────────────────────┐◀─────────────────────┘
         │ PostgreSQL            │
         │  public.*  (Medusa)   │
         │  baker_network.*      │
         │  pricing.*            │
         │  constraints.*        │
         │  ai_studio.*          │
         └───────────────────────┘`}</Code>

        <p>
          Note the asymmetry: <strong>OPS talks to Postgres directly</strong>, the other two never
          do. OPS is an internal tool that predates the baker features and reads operational tables
          the customer-facing apps have no business seeing.
        </p>
      </Section>

      <Section title="What each app may do">
        <Table
          head={["App", "Database access", "Holds secrets", "Decides authorization"]}
          rows={[
            ["Storefront", "No — via backend only", "No", "No"],
            ["Baker Portal", <strong key="a">No — deliberately impossible</strong>, <strong key="b">No</strong>, "No"],
            ["OPS", "Yes — direct SQL", "Yes (session + service key)", "Its own login only"],
            ["Backend", "Yes — owns it", "Yes", <strong key="c">Yes — always</strong>],
          ]}
        />

        <SubSection title="Why the Baker Portal has no credentials">
          <p>
            The portal has no database driver, no token-verification library and no{" "}
            <Term>DATABASE_URL</Term>. It holds an opaque session token issued by the backend and
            forwards it; every real question — is this session valid, is this baker active, does
            this baker own that product — is answered by the backend on every request.
          </p>
          <p>
            This is enforced by absence rather than discipline. A frontend that <em>could</em>{" "}
            answer &ldquo;which baker am I&rdquo; can eventually be persuaded to answer it wrongly,
            so the capability simply is not there. There are automated tests that fail if anyone
            adds <Term>pg</Term>, <Term>jose</Term> or <Term>bcryptjs</Term> to that project.
          </p>
        </SubSection>
      </Section>

      <Section title="Three separate identities">
        <p>
          Three kinds of people sign in, and they are kept apart cryptographically — not by cookie
          names or route prefixes.
        </p>
        <Table
          head={["Identity", "Cookie", "Signed with", "Stored in", "Lifetime"]}
          rows={[
            ["Customer", <Term key="a">_medusa_jwt</Term>, <Term key="b">JWT_SECRET</Term>, <Term key="c">public.customer</Term>, "7 days"],
            ["Baker", <Term key="d">baker_session</Term>, <Term key="e">BAKER_SESSION_SECRET</Term>, <Term key="f">baker_network.baker_users</Term>, "7 days"],
            ["OPS", <Term key="g">ops_session</Term>, <Term key="h">SESSION_SECRET</Term>, <Term key="i">baker_network.ops_users</Term>, "7 days"],
          ]}
        />
        <Callout tone="danger" title="These three secrets must never share a value">
          <p>
            Distinct keys mean a leak of one compromises exactly one identity domain. Share a key
            between two and a leak in either — a repo, a container, a log line, an <Term>.env</Term>{" "}
            committed by accident — silently compromises both. There is a test that mints a token
            with the OPS secret and confirms the baker API rejects it; that test only passes because
            the keys differ.
          </p>
        </Callout>
      </Section>

      <Section title="How OPS talks to the backend">
        <p>
          OPS reads Postgres directly for almost everything. It calls the backend for exactly two
          things:
        </p>
        <Bullets
          items={[
            <>
              <strong>Issuing baker invitations</strong> — <Term>POST /ops/bakers/:id/activation</Term>.
              That logic (token hashing, revoking the previous invite, refusing an already-claimed
              bakery) must have one implementation, so OPS calls it rather than duplicating it.
            </>,
            <>
              <strong>The pricing simulator</strong> — it needs the live pricing engine, which lives
              in the backend.
            </>,
          ]}
        />
        <p>
          The invitation endpoint is authenticated with <Term>OPS_SERVICE_KEY</Term>, a shared
          secret sent as a header. It is <em>not</em> a user identity: it proves the caller is the
          OPS application, nothing more. The human authorization already happened when the OPS user
          signed in with <Term>ops_session</Term> before the server action ran.
        </p>
        <Callout tone="warn" title="Why that endpoint needs protecting at all">
          <p>
            It <strong>mints a credential</strong>. An activation token is enough to set a
            bakery&apos;s password and take over their account. The backend is publicly reachable,
            so without the key anyone who could reach it could issue an invite for any bakery and
            claim it.
          </p>
        </Callout>
      </Section>

      <Section title="Database schemas">
        <Table
          head={["Schema", "Owned by", "Contains"]}
          rows={[
            [<Term key="a">public</Term>, "Medusa", "Products, variants, prices, carts, orders, customers, sales channels, categories"],
            [<Term key="b">baker_network</Term>, "CrossFriend", "bakers, baker_users, baker_products, baker_activations, baker_images, baker_discoveries, ops_users, pincode_directory, pincode_service_status"],
            [<Term key="c">pricing</Term>, "CrossFriend", "AI Studio pricing engine — attributes, rules, regions, evaluations"],
            [<Term key="d">constraints</Term>, "CrossFriend", "AI Studio option constraints — which combinations are allowed"],
            [<Term key="e">ai_studio</Term>, "CrossFriend", "Generated cake designs, likes, comments"],
          ]}
        />
        <p>
          You can browse all of these read-only in{" "}
          <Link href="/database" className="text-slate-900 underline">
            Database
          </Link>
          .
        </p>
      </Section>

      <Section title="Sharing a backend with Pranajiva">
        <p>
          Pranajiva is a separate wellness storefront on the same backend and the same database. Two
          mechanisms keep the catalogues apart, and understanding them explains several otherwise
          odd behaviours.
        </p>

        <SubSection title="Sales channels — the real partition">
          <p>
            Every product belongs to one or more sales channels. CrossFriend products live on the{" "}
            <Term>crossfriend</Term> channel; Pranajiva&apos;s live on <Term>Pranajiva</Term>.
          </p>
          <Callout tone="danger" title="The store's DEFAULT channel is Pranajiva's">
            <p>
              A products query that names no channel is answered from the default — so it returns
              Pranajiva&apos;s catalogue, not an error. Any CrossFriend product then appears simply
              &ldquo;not found&rdquo;. Every storefront product read passes{" "}
              <Term>sales_channel_id</Term> explicitly for this reason, and carts are created on the
              CrossFriend channel too. Medusa refuses a line item whose product is not on the
              cart&apos;s channel, so this is also what makes anything buyable at all.
            </p>
          </Callout>
        </SubSection>

        <SubSection title="metadata.brand — the legacy partition">
          <p>
            Products also carry <Term>metadata.brand = &quot;crossfriend&quot;</Term>. This predates
            the sales channel and is kept for compatibility, but it must not be used for filtering:
            Medusa cannot filter on metadata server-side, so doing so means fetching the entire
            catalogue and filtering in JavaScript — which breaks pagination and does not scale.
          </p>
        </SubSection>
      </Section>

      <Section title="Where data actually lives">
        <p>
          One question causes more confusion than any other: <em>who owns a product?</em>
        </p>
        <Code>{`baker_network.baker_products     ← THE authority on ownership
  baker_id                          who owns it
  medusa_product_id                 what they own (UNIQUE — one owner only)
  publication_state                 CrossFriend's own lifecycle

public.product.metadata
  baker_name, baker_slug            ← a RENDERING CACHE, never an authority`}</Code>
        <p>
          Product metadata carries the baker&apos;s name and slug so a grid of 24 products costs one
          query instead of 25. It is written once at creation and never consulted for authorization.
          Every baker-scoped read and write joins through <Term>baker_products</Term> using the
          baker id resolved from the session — never from a request body, and never from metadata.
        </p>
      </Section>
    </>
  )
}
