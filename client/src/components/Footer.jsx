export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row">
        <p>© {new Date().getFullYear()} TicketFlow · Concerts, buses, trains & rooms across Bangladesh</p>
        <p>Payments are simulated (bKash / Nagad / Card mock providers)</p>
      </div>
    </footer>
  );
}
