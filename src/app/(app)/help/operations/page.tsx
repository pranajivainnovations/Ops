import Link from "next/link"

import { Bullets, Callout, Code, PageHeader, Section, Steps, SubSection, Table, Term } from "../_components/doc"

export const metadata = { title: "Handbook — Operations" }

export default function OperationsPage() {
  return (
    <>
      <PageHeader
        title="Operations"
        intro="Day-to-day tasks, first-time setup, secrets, and deploying each application. Everything here has been run against the real system."
      />

      <Section title="What OPS is for">
        <Table
          head={["Section", "Use it to"]}
          rows={[
            [<Link key="a" href="/bakers" className="font-semibold text-slate-900 underline">Bakers</Link>, "Create and edit bakeries, upload their photos, invite them to the portal, control whether their profile is public"],
            [<Link key="b" href="/bakers/discoveries" className="font-semibold text-slate-900 underline">Discoveries</Link>, "Review bakeries found by the Google Places sweep and promote the good ones"],
            [<Link key="c" href="/bakers/assignments" className="font-semibold text-slate-900 underline">Assignments</Link>, "Assign a baker to orders that came in as 'Order via CrossFriend'"],
            [<Link key="d" href="/pincodes" className="font-semibold text-slate-900 underline">Pincodes</Link>, "Turn delivery on or off for a pincode. A pincode that is off shows 'coming soon' to customers"],
            [<Link key="e" href="/pricing" className="font-semibold text-slate-900 underline">Pricing</Link>, "Author the AI Cake Studio pricing rules, and simulate a quote before publishing"],
            [<Link key="f" href="/constraints" className="font-semibold text-slate-900 underline">Constraints</Link>, "Author which cake option combinations are allowed"],
            [<Link key="g" href="/database" className="font-semibold text-slate-900 underline">Database</Link>, "Read-only browse of every schema and table, for debugging"],
            [<Link key="h" href="/rnd" className="font-semibold text-slate-900 underline">R&D</Link>, "Research notes and category exploration"],
            [<Link key="i" href="/team" className="font-semibold text-slate-900 underline">Team</Link>, "Add OPS accounts for colleagues"],
          ]}
        />
      </Section>

      <Section title="Common tasks">
        <SubSection title="Onboard a new bakery">
          <Steps
            items={[
              <>Promote it from Discoveries, or create it in Bakers → New baker.</>,
              <>Fill in city, pincode, specialties and turnaround. Upload a profile photo and banner.</>,
              <>Invite them from the Baker portal access panel and send the link plus their Baker ID.</>,
              <>
                Once they have published a product, set <Term>is_public</Term> so their profile
                appears on the storefront.
              </>,
            ]}
          />
        </SubSection>

        <SubSection title="Take a product off sale urgently">
          <p>
            Bakers can pause their own listings, but if you need to act without them: set the
            bakery&apos;s <Term>is_active = false</Term>, which signs them out immediately — but
            note this does <strong>not</strong> unpublish their products. To remove a specific
            listing from the marketplace right now, change it in Medusa Admin, or set the
            bakery&apos;s <Term>is_public</Term> off so the profile disappears while you sort it out.
          </p>
        </SubSection>

        <SubSection title="Open a new delivery area">
          <p>
            Search the pincode in Pincodes and enable it. Until then, customers there see &ldquo;we
            don&apos;t deliver to your area yet&rdquo; even if bakers exist nearby.
          </p>
        </SubSection>
      </Section>

      <Section title="First-time setup">
        <SubSection title="Create the first OPS account">
          <p>
            There is no signup screen — the first account is created with a script, run from the OPS
            project on a machine that can reach the database:
          </p>
          <Code>{`cd crossfriend-ops
node scripts/seed-admin.js you@crossfriend.in "your password" "Your Name"`}</Code>
          <p>
            Re-running it with the same email <strong>updates the password</strong> instead of
            failing, so it doubles as the password-reset tool — there is no self-service reset. It
            reads <Term>DATABASE_URL</Term> from <Term>.env.local</Term>.
          </p>
          <p>
            After that, add colleagues through{" "}
            <Link href="/team/new" className="text-slate-900 underline">
              Team → Add a team member
            </Link>
            .
          </p>
          <Callout tone="warn" title="Every OPS user can do everything">
            <p>
              There are no roles. Anyone with an OPS login can invite bakers, change pricing rules
              and browse the database. Only create accounts for people who should have all of that.
            </p>
          </Callout>
        </SubSection>

        <SubSection title="Generate the secrets">
          <p>Run this once per secret — each needs its own distinct value:</p>
          <Code>{`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`}</Code>
          <p>That produces 64 URL-safe characters from a cryptographic RNG. You need four in total:</p>
          <Table
            head={["Secret", "Lives in", "Must match elsewhere?"]}
            rows={[
              [<Term key="a">JWT_SECRET</Term>, "Backend", "No — Medusa customer sessions"],
              [<Term key="b">SESSION_SECRET</Term>, "OPS", "No — OPS logins"],
              [<Term key="c">BAKER_SESSION_SECRET</Term>, "Backend only", "No — signs baker sessions"],
              [<Term key="d">OPS_SERVICE_KEY</Term>, "Backend AND OPS", <strong key="e">Yes — identical in both</strong>],
            ]}
          />
          <Callout tone="danger" title="All four must be different values">
            <p>
              Sharing a value between two of them means a leak in either compromises both. See{" "}
              <Link href="/help/architecture" className="underline">
                Architecture
              </Link>{" "}
              for why.
            </p>
          </Callout>
          <p>
            <strong>Rotating them:</strong> changing <Term>BAKER_SESSION_SECRET</Term> signs every
            baker out — their passwords are unaffected, so they simply sign in again. Changing{" "}
            <Term>OPS_SERVICE_KEY</Term> has no user impact, but the backend and OPS must be
            restarted together or inviting bakers returns <Term>401</Term> in between.
          </p>
        </SubSection>

        <SubSection title="Required configuration">
          <Table
            head={["App", "Must be set"]}
            rows={[
              ["Backend", <Term key="a">DATABASE_URL, REDIS_URL, JWT_SECRET, COOKIE_SECRET, BAKER_SESSION_SECRET, OPS_SERVICE_KEY, S3_*</Term>],
              ["OPS", <Term key="b">DATABASE_URL, SESSION_SECRET, OPS_SERVICE_KEY, MEDUSA_BACKEND_URL, BAKER_PORTAL_URL, S3_*, GOOGLE_PLACES_API_KEY, GOOGLE_DRIVE_*</Term>],
              ["Baker Portal", <Term key="c">MEDUSA_BACKEND_URL</Term>],
              ["Storefront", <Term key="d">MEDUSA_BACKEND_URL</Term>],
            ]}
          />
          <Callout tone="danger" title="BAKER_PORTAL_URL must be the public portal address">
            <p>
              It builds the activation link you send to bakers. Left as{" "}
              <Term>http://localhost:5000</Term>, every invitation you send is unusable by the
              recipient — and you will not find out until a baker tells you.
            </p>
          </Callout>
        </SubSection>
      </Section>

      <Section title="Deploying">
        <p>
          Each application deploys independently. OPS, the Baker Portal and the backend each have a{" "}
          <Term>deploy.sh</Term> that builds the image, ships it and restarts the container.
        </p>
        <Code>{`cd crossfriend-ops              && ./deploy.sh     # or double-click deploy.bat
cd crossfriend-baker-portal    && ./deploy.sh
cd Backend/Backend             && ./deploy.sh`}</Code>
        <Callout tone="warn" title="Environment variables must be listed in docker-compose.yml">
          <p>
            The compose files enumerate each variable explicitly. A variable present in{" "}
            <Term>.env</Term> but missing from the compose <Term>environment:</Term> block never
            reaches the container — the app then behaves as if it were unset, with no error. This has
            silently broken features here more than once.
          </p>
        </Callout>
        <SubSection title="Database migrations">
          <p>
            Schema changes live in the backend repository and are applied with:
          </p>
          <Code>{`cd Backend/Backend
npm run build:server
npx medusa migrations run`}</Code>
          <p>
            A running Node process keeps the code it loaded at boot, so rebuilding underneath it does
            nothing — <strong>restart the backend after any code change</strong>.
          </p>
        </SubSection>
      </Section>

      <Section title="Operational considerations">
        <Bullets
          items={[
            <>
              <strong>The database is far from the backend.</strong> Postgres is on Oracle Cloud, the
              backend on AWS, so every query crosses the public internet — roughly 54 ms per round
              trip measured locally. Medusa issues dozens of queries per request, so this dominates
              response time. Co-locating them is the single biggest performance improvement
              available and needs no code change.
            </>,
            <>
              <strong>S3 is shared.</strong> One bucket holds AI Studio designs, customer uploads and
              baker images under separate prefixes. Bucket versioning is enabled, so deleted objects
              are recoverable.
            </>,
            <>
              <strong>Redis</strong> is used by Medusa for cache, sessions and events, and is also
              remote from the backend.
            </>,
            <>
              <strong>No automated backups are configured</strong> as far as this system is
              concerned. Take a <Term>pg_dump</Term> before any destructive operation.
            </>,
          ]}
        />
      </Section>
    </>
  )
}
