import Link from "next/link"

import { Bullets, Callout, Code, PageHeader, Section, Steps, SubSection, Table, Term } from "../_components/doc"

export const metadata = { title: "Handbook — Baker onboarding" }

export default function BakersPage() {
  return (
    <>
      <PageHeader
        title="Baker onboarding"
        intro="How a bakery goes from a pin on Google Maps to an account that can list products. This is the flow you will run most often, so it is worth reading in full."
      />

      <Section title="The pipeline">
        <Code>{`Google Places sweep
      │  ops reviews
      ▼
baker_discoveries          unclaimed, no login, not public
      │  ops promotes
      ▼
bakers                     Baker ID assigned automatically (CFB-00042)
      │  ops issues an invite
      ▼
baker_activations          single-use token, 14-day expiry
      │  baker sets a password
      ▼
baker_users (role owner)   CLAIMED — can now sign in`}</Code>

        <Callout tone="info" title="Invite-only, by design">
          <p>
            There is no public registration and no self-service password reset. A bakery that loses
            access is re-invited by your team. Everything a baker publishes appears on the customer
            storefront under CrossFriend&apos;s name, so the people who can create baker accounts are
            the same people who verified the bakery exists.
          </p>
        </Callout>
      </Section>

      <Section title="Baker IDs">
        <p>
          Every baker gets a human-readable identifier the moment the record is created:{" "}
          <Term>CFB-00001</Term>, <Term>CFB-00002</Term>, and so on. It is assigned automatically by
          the database — nothing in the UI mints it.
        </p>
        <Bullets
          items={[
            <>
              <strong>It is the login username.</strong> Bakers sign in with Baker ID + password,
              not email. Google Places data routinely has a missing, shared or wrong email; an ID we
              mint ourselves is always present and can be read out over a phone call.
            </>,
            <>
              <strong>It never changes.</strong> A database trigger rejects any attempt to update
              it, including a manual <Term>UPDATE</Term>. A baker whose ID changed would be locked
              out with no self-service way back in.
            </>,
            <>
              <strong>It is case-insensitive at login.</strong> <Term>cfb-42</Term> works.
            </>,
          ]}
        />
      </Section>

      <Section title="Activation states">
        <p>
          The baker detail page shows one of four states. It is derived live from the database, not
          stored as a flag — a flag would be a second source of truth that can disagree with the
          account it describes.
        </p>
        <Table
          head={["State", "Means", "What you can do"]}
          rows={[
            [
              <strong key="a">Not invited</strong>,
              "Baker record exists, no invitation has ever been sent",
              "Invite baker",
            ],
            [
              <strong key="b">Invited</strong>,
              "A live, unused invitation exists",
              "Send a new invite (revokes the old link)",
            ],
            [
              <strong key="c">Invite expired</strong>,
              "The invitation passed 14 days unused",
              "Send a new invite",
            ],
            [
              <strong key="d">Activated</strong>,
              "The bakery has set a password and can sign in",
              "Nothing — onboarding is complete",
            ],
          ]}
        />
      </Section>

      <Section title="How to invite a baker">
        <Steps
          items={[
            <>
              Open{" "}
              <Link href="/bakers" className="text-slate-900 underline">
                Bakers
              </Link>{" "}
              and select the bakery. If it does not exist yet, promote it from{" "}
              <Link href="/bakers/discoveries" className="text-slate-900 underline">
                Discoveries
              </Link>{" "}
              or create it with <strong>New baker</strong>.
            </>,
            <>
              Check the bakery is <Term>is_active</Term>. An inactive bakery cannot be invited — the
              backend refuses with a clear message.
            </>,
            <>
              Find the <strong>Baker portal access</strong> panel and click{" "}
              <strong>Invite baker</strong>.
            </>,
            <>
              <strong>Copy the link immediately.</strong> It is shown once and is never recoverable.
              Use the Copy link button.
            </>,
            <>
              Send it to the bakery by WhatsApp or email, along with their Baker ID — they will need
              the ID to sign in afterwards.
            </>,
          ]}
        />

        <Callout tone="danger" title="The link cannot be retrieved later">
          <p>
            Only a SHA-256 hash of the token is stored. There is no endpoint — here or anywhere —
            that can show it again. If you lose it before sending, issue a new one; that revokes the
            previous link.
          </p>
          <p>
            This is deliberate. An invitation you could re-read from the database is an invitation
            an attacker could re-read too.
          </p>
        </Callout>
      </Section>

      <Section title="Re-inviting">
        <p>
          Sending a new invite <strong>immediately cancels the previous link</strong>. There is never
          more than one valid invitation per bakery.
        </p>
        <p>
          This matters when a baker says &ldquo;I never got it&rdquo;. If they actually did get it
          and are about to use it, issuing a second one breaks the first. Confirm they have not
          already opened it before re-issuing.
        </p>
        <Table
          head={["Situation", "What happens"]}
          rows={[
            ["Re-invite a bakery in Invited state", "Old token revoked, new one issued"],
            ["Re-invite after expiry", "New token issued, 14 more days"],
            ["Re-invite an Activated bakery", <>Refused — <Term key="a">409</Term>, &ldquo;already set up its account&rdquo;</>],
            ["Invite an inactive bakery", <>Refused — <Term key="b">409</Term>, reactivate it first</>],
          ]}
        />
      </Section>

      <Section title="What the baker experiences">
        <Steps
          items={[
            <>
              They open the link. The portal <strong>shows their bakery name and Baker ID before
              asking for anything</strong> — that is how they know the link is genuinely theirs. A
              page that demands a secret while telling you nothing is indistinguishable from
              phishing.
            </>,
            <>
              They choose a password (minimum 10 characters) and optionally give a contact name and
              email. Email is contact detail only — never a login credential.
            </>,
            <>
              They are signed in immediately. Making someone who just proved control of the account
              re-enter the password they set two seconds ago is friction with no security value.
            </>,
            <>
              From then on they sign in at <Term>baker.crossfriend.in</Term> with their Baker ID and
              password.
            </>,
          ]}
        />
      </Section>

      <Section title="Deactivating a baker">
        <p>
          Setting <Term>is_active = false</Term> on a bakery takes effect{" "}
          <strong>on their next click</strong>, not when their session expires. Every request
          re-reads that flag. The same applies to deactivating an individual{" "}
          <Term>baker_users</Term> row.
        </p>
        <Callout tone="warn" title="Deactivating does not unpublish their products">
          <p>
            Their listings stay live in the marketplace. If you need them off sale, change each
            product&apos;s publication state as well — see{" "}
            <Link href="/help/products" className="underline">
              Products
            </Link>
            .
          </p>
        </Callout>
      </Section>

      <Section title="Public baker profiles">
        <p>
          A baker only appears on the customer storefront when <strong>both</strong>{" "}
          <Term>is_public</Term> and <Term>is_active</Term> are true. New bakers default to{" "}
          <Term>is_public = false</Term>, so onboarding one does not immediately expose a
          half-finished profile.
        </p>
        <SubSection title="Slugs">
          <p>
            Every baker gets a URL slug automatically from their name —{" "}
            <Term>Sweet Moments Bakery</Term> becomes <Term>/bakers/sweet-moments-bakery</Term>.
            Duplicates get a numeric suffix. A name with no Latin characters falls back to the Baker
            ID.
          </p>
          <p>
            Unlike the Baker ID, slugs <strong>can</strong> be edited — useful when the automatic one
            is awkward. Changing it breaks any link already shared.
          </p>
        </SubSection>
      </Section>
    </>
  )
}
