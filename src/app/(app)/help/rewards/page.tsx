import Link from "next/link"

import {
  Bullets,
  Callout,
  Code,
  PageHeader,
  Section,
  Steps,
  SubSection,
  Table,
  Term,
} from "../_components/doc"

export const metadata = { title: "Handbook — Rewards & wallet" }

/**
 * Training material for the ops team on customer credit.
 *
 * Written for somebody who has never seen the rewards screens and will one day be asked, on the
 * phone, why a customer's ₹200 only took ₹112 off their order. Every section is either a thing they
 * will have to do or a question they will have to answer — nothing here describes how it is built,
 * because that has never helped anybody at the other end of a support call.
 */
export default function RewardsHandbookPage() {
  return (
    <>
      <PageHeader
        title="Rewards & wallet"
        intro="Customers hold credit they can spend only with us. This is what gives it to them, what your team controls, and what to say when they ring up."
      />

      <Section title="The idea in one paragraph">
        <p className="text-sm leading-relaxed text-slate-700">
          Instead of discounting a cake, we give the customer money that lives in their CrossFriend
          wallet. They can only spend it here, it expires, and it costs us nothing until it is used.
          Credit arrives four different ways, and every amount, area and deadline behind them is a
          setting on the <Link href="/rewards" className="font-semibold text-slate-900 underline">Rewards</Link>{" "}
          screen — nothing here is fixed in code.
        </p>

        <Table
          head={["Credit", "What earns it", "Typical amount"]}
          rows={[
            [
              <strong key="a">Welcome bonus</strong>,
              "Creating an account, once we know their pincode. Nothing needs to be bought.",
              "Your choice — off by default",
            ],
            [
              <strong key="b">Celebration credit</strong>,
              "Placing a first order, then a second. Two separate grants.",
              "₹100 + ₹100",
            ],
            [
              <strong key="c">Referral credit</strong>,
              "A friend they invited receives a delivered order.",
              "5% of it, up to ₹100",
            ],
            [
              <strong key="d">From our team</strong>,
              "You decide — an apology, a goodwill gesture, a fix.",
              "Anything, with a reason",
            ],
          ]}
        />

        <Callout tone="warn" title="Only one of these is given for nothing">
          <p>
            Celebration credit and referral credit are <em>earned</em> — somebody has to buy a cake, so
            abusing them costs more than they pay out. The welcome bonus pays for an account and
            nothing else. Keep its budget tight and its expiry short, and treat switching it on as a
            decision rather than a default.
          </p>
        </Callout>
      </Section>

      <Section title="Everything is decided by pincode">
        <p className="text-sm leading-relaxed text-slate-700">
          A reward runs where you say it runs. On each card in{" "}
          <Link href="/rewards" className="font-semibold text-slate-900 underline">Rewards</Link> there is
          a <Term>Where it runs</Term> block with two choices:
        </p>
        <Bullets
          items={[
            <>
              <strong>Selected pincodes</strong> — tick the ones you mean. Everywhere else, the reward
              simply does not exist.
            </>,
            <>
              <strong>Every pincode</strong> — including areas onboarded next month, without anybody
              switching it on again.
            </>,
          ]}
        />
        <p className="text-sm leading-relaxed text-slate-700">
          The number beside each pincode — <Code>3/3</Code> or <Code>1/3</Code> — is how many bakeries
          there are live with a published product. Below three, a reward is accepted but does not
          serve. You can still tick a pincode that opens next week.
        </p>

        <SubSection title="Changing it for one area only">
          <p className="text-sm leading-relaxed text-slate-700">
            Open <Code>/pincodes/201016</Code> and change anything just there — a bigger grant for a
            launch, a pause while a bakery is on holiday. Anything you leave blank keeps following the
            brand setting, so you never have to restate the parts you are not changing.
          </p>
        </SubSection>

        <Callout tone="info" title="A pincode setting always wins">
          <p>
            If a pincode has its own row, that row decides — even if the brand list does not include
            it. That is how you pilot one area without touching anything else, and how you pause one
            without editing a list.
          </p>
        </Callout>
      </Section>

      <Section title="How your team actually works with it">
        <SubSection title="Starting a reward in a new area">
          <Steps
            items={[
              <>Check the pincode is onboarded and three bakeries are live — the picker shows <Code>3/3</Code>.</>,
              <>Open <Link href="/rewards" className="font-semibold text-slate-900 underline">Rewards</Link>, find the reward, tick the pincode under <Term>Where it runs</Term>.</>,
              <>Set a <strong>budget</strong>. It is mandatory — there is no unlimited option, and the reward stops itself when the budget is spent.</>,
              <>Set a <strong>grant cap</strong> if you want a hard limit on how many people can claim it.</>,
              <>Write a note saying why. It goes on the record beside the change.</>,
              <>Save, and watch the outcomes on <Code>/pincodes/&lt;code&gt;</Code> over the next few days.</>,
            ]}
          />
        </SubSection>

        <SubSection title="Giving one customer credit">
          <p className="text-sm leading-relaxed text-slate-700">
            <Link href="/rewards/grant" className="font-semibold text-slate-900 underline">
              Rewards → Give a customer credit
            </Link>
            . Enter the mobile they sign in with, an amount in rupees, and a reason. It is in their
            wallet immediately.
          </p>
          <Callout tone="danger" title="The reason is not a formality">
            <p>
              Every other entry in the wallet can be explained by replaying a rule. This one can only
              be explained by you. Write what actually happened — &ldquo;Order #1043 arrived two hours
              late for a birthday, agreed ₹300 with the customer on the phone&rdquo; — not
              &ldquo;goodwill&rdquo;. In three months that line is the only defence anybody has.
            </p>
          </Callout>
          <p className="text-sm leading-relaxed text-slate-700">
            The same screen lists every grant given by hand, who gave it, and a 30-day total. This is
            the only payment with no budget behind it, so being visible is what keeps it honest.
          </p>
        </SubSection>

        <SubSection title="Stopping something">
          <Bullets
            items={[
              <><strong>One reward, one area</strong> — open the pincode and switch it off there.</>,
              <><strong>One reward, everywhere</strong> — untick its pincodes, or switch the card off.</>,
              <><strong>Everything, instantly</strong> — the global switch on the Rewards screen.</>,
            ]}
          />
          <Callout tone="warn" title="Switching off stops new grants, not old ones">
            <p>
              Credit a customer already holds keeps its expiry and stays spendable, and a second
              celebration grant already promised by a first still arrives. What you owe does not change
              today — the outstanding figure on the Rewards screen is the number to watch.
            </p>
          </Callout>
        </SubSection>
      </Section>

      <Section title="What the customer sees">
        <Steps
          items={[
            <>
              <strong>They arrive and we ask for their pincode.</strong> &ldquo;Unlock the offer in your
              area.&rdquo; They can skip it. We ask again in the bar at the bottom, in the cake studio,
              and at checkout — any one of them counts.
            </>,
            <>
              <strong>They sign in with their mobile.</strong> If a welcome bonus is running where they
              are, it is in their wallet before they have bought anything.
            </>,
            <>
              <strong>They order.</strong> ₹100 arrives, and their account says another ₹100 is waiting
              on the next order.
            </>,
            <>
              <strong>They come back.</strong> At checkout: &ldquo;You have ₹200 — use ₹112 on this
              order.&rdquo; One tap and what they pay drops. They can remove it again.
            </>,
            <>
              <strong>They invite a friend.</strong> Their account has a code and a share button, and
              shows who joined, what is still holding, and what has paid.
            </>,
          ]}
        />
        <p className="text-sm leading-relaxed text-slate-700">
          Their wallet lives on their account page: a balance, what it is made of, an amber band naming
          anything about to expire, the activity list, and a short &ldquo;Good to know&rdquo; block.
        </p>
      </Section>

      <Section title="Questions you will be asked">
        <SubSection title="“I have ₹200 but it only took ₹112 off”">
          <p className="text-sm leading-relaxed text-slate-700">
            There is a limit on how much of any one order credit may pay for — <strong>15% today</strong>
            {" "}— so a balance is spent across a few visits rather than all at once. The rest is still
            theirs and has not gone anywhere.
          </p>
          <p className="text-sm leading-relaxed text-slate-700">
            The limit is a share of <strong>the amount they are asked to pay</strong>, after any coupon.
            You can change it: Rewards → <Term>Economics</Term> → Promo redemption cap. It can be set
            per pincode too.
          </p>
        </SubSection>

        <SubSection title="“Why is delivery still being charged?”">
          <p className="text-sm leading-relaxed text-slate-700">
            Credit pays for the cakes, not the delivery charge or tax. That is a platform rule, not a
            setting — so on a small order the credit may stop short of the full limit, and checkout says
            so: <em>&ldquo;Credit covers the items — ₹699 on this order.&rdquo;</em>
          </p>
        </SubSection>

        <SubSection title="“I signed up but got no welcome bonus”">
          <p className="text-sm leading-relaxed text-slate-700">Work through these in order:</p>
          <Bullets
            items={[
              <>Is the welcome bonus switched on at all? It is <strong>off by default</strong>.</>,
              <>Does it run in their area? Check <Term>Where it runs</Term>.</>,
              <>
                <strong>Did they ever give us a pincode?</strong> This is the usual answer. If the reward
                runs in named pincodes and we do not know where they are, they get nothing —{" "}
                <em>yet</em>. Ask them to enter their pincode anywhere on the site and it arrives.
              </>,
              <>Has the budget or the grant cap been reached? The Rewards screen shows both.</>,
              <>Have they already had one? It is once per customer, for good.</>,
            ]}
          />
        </SubSection>

        <SubSection title="“My friend ordered but I have not been paid”">
          <p className="text-sm leading-relaxed text-slate-700">
            Referral credit is owed after the order is <strong>delivered</strong> and the return window
            has closed, and it is paid by a job that runs each morning. So check, in order: has the order
            been marked delivered in{" "}
            <Link href="/orders" className="font-semibold text-slate-900 underline">Orders</Link>?
            Has the hold period passed? Has the referrer hit their monthly or yearly earning limit?
          </p>
          <Callout tone="info" title="Marking delivery is ours, not the bakery's">
            <p>
              Referral payouts start from the delivery mark, so an order sitting in <Term>Ready</Term> is
              waiting on us. Orders → <Term>To deliver</Term> is that queue.
            </p>
          </Callout>
        </SubSection>

        <SubSection title="“Can I send my credit to my sister / get it as cash?”">
          <p className="text-sm leading-relaxed text-slate-700">
            No, to both. Credit is tied to the account that earned it and cannot be withdrawn. It is
            written on their account page under &ldquo;Good to know&rdquo; so it should rarely be a
            surprise.
          </p>
        </SubSection>

        <SubSection title="“My credit disappeared”">
          <p className="text-sm leading-relaxed text-slate-700">
            Almost always expiry. Each grant carries its own date, and their activity list shows an
            &ldquo;Expired&rdquo; line when it happens. The other possibility is an order that was
            cancelled or refunded, which takes back the credit it earned.
          </p>
          <p className="text-sm leading-relaxed text-slate-700">
            If it was our fault, put it right from{" "}
            <Link href="/rewards/grant" className="font-semibold text-slate-900 underline">
              Give a customer credit
            </Link>{" "}
            and say so in the reason.
          </p>
        </SubSection>

        <SubSection title="“I have two accounts — can you merge the credit?”">
          <p className="text-sm leading-relaxed text-slate-700">
            There is no merge. One mobile number is one customer, so two accounts means two numbers.
            Decide which one they will keep using, and move the balance across with a manual grant —
            naming the other number in the reason.
          </p>
        </SubSection>
      </Section>

      <Section title="Things that are true and worth remembering">
        <Bullets
          items={[
            <>
              <strong>Nothing is ever overwritten.</strong> Every change to a reward is saved as a new
              version, and the old one stays readable — so a grant paid last month can still explain
              which rules paid it, and you can always see who changed what.
            </>,
            <>
              <strong>A reward cannot run where we cannot deliver.</strong> Three live bakeries with a
              published product, or it does not serve — however it is configured.
            </>,
            <>
              <strong>One reward per mobile, and per delivery address.</strong> The cheap fraud is
              several accounts ordering to one flat; that is what the address limit is for.
            </>,
            <>
              <strong>Referrals cannot be circular.</strong> Nobody can refer themselves, and a ring of
              accounts referring each other is refused.
            </>,
            <>
              <strong>A budget is compulsory.</strong> There is no unlimited option anywhere, on purpose.
            </>,
          ]}
        />
      </Section>

      <Section title="Where to look">
        <Table
          head={["To do this", "Go here"]}
          rows={[
            ["Change amounts, areas, budgets", <Code key="a">/rewards</Code>],
            ["See what one area has issued and got back", <Code key="b">/pincodes/&lt;pincode&gt;</Code>],
            ["Give one customer credit", <Code key="c">/rewards/grant</Code>],
            ["Mark an order delivered", <><Code>/orders</Code> → To deliver</>],
            ["Stop everything at once", <>Global switch on <Code>/rewards</Code></>],
          ]}
        />
      </Section>
    </>
  )
}
