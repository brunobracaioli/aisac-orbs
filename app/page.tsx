export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <section className="mx-auto flex max-w-3xl flex-col gap-4">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-cyan-300">AISAC Orbs</p>
        <h1 className="text-4xl font-semibold tracking-tight">Wave 0 scaffold</h1>
        <p role="status" className="max-w-xl text-slate-300">
          The application shell is ready for the provider-independent semantic core and renderer
          waves.
        </p>
      </section>
    </main>
  );
}
