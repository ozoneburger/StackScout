export function ContentPage({ eyebrow, title, summary, children }) {
  return (
    <main className="app content-page">
      <section className="content-hero" aria-labelledby="content-title">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="content-title">{title}</h1>
        {summary ? <p className="summary">{summary}</p> : null}
      </section>
      <section className="content-panel">
        {children}
      </section>
    </main>
  );
}
