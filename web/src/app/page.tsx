import Link from "next/link";
import { ReceptionistCard } from "@/components/ReceptionistCard";

const CAN_DO = [
  ["Book", "a visit with the right doctor"],
  ["Reschedule", "to a slot that suits you"],
  ["Cancel", "without waiting on hold"],
  ["Answer", "timings, fees and test preparation"],
];

const HOURS = [
  ["Mon – Sat", "10:00 – 13:00 · 17:00 – 20:00"],
  ["Sunday", "Closed"],
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-rule bg-surface">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="text-lg font-semibold tracking-tight">Arogya Clinic</span>
          <Link
            href="/console"
            className="font-mono text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Developer console →
          </Link>
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
              Family clinic · Bengaluru
            </span>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Talk to Asha. She&apos;ll sort your appointment.
            </h1>
            <p className="max-w-lg text-lg text-muted">
              Our receptionist answers in Hindi, English or a bit of both, any time the clinic is
              open. Urgent symptoms go straight to a doctor on duty.
            </p>
          </div>

          <ul className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
            {CAN_DO.map(([verb, rest]) => (
              <li key={verb} className="rounded-xl border border-rule bg-surface px-4 py-3 text-sm">
                <span className="font-semibold">{verb}</span>{" "}
                <span className="text-muted">{rest}</span>
              </li>
            ))}
          </ul>

          <dl className="flex max-w-lg flex-col gap-1.5 border-t border-rule pt-5 text-sm">
            <dt className="mb-1 font-mono text-[11px] uppercase tracking-wider text-faint">
              OPD timings
            </dt>
            {HOURS.map(([days, time]) => (
              <dd key={days} className="flex justify-between gap-4">
                <span className="text-muted">{days}</span>
                <span className="font-mono tabular-nums">{time}</span>
              </dd>
            ))}
          </dl>
        </div>

        <ReceptionistCard />
      </main>

      <footer className="border-t border-rule px-4 py-5 text-center text-xs text-faint">
        In an emergency, call 112. Asha books appointments; she doesn&apos;t give medical advice.
      </footer>
    </div>
  );
}
