import { cookies, headers } from "next/headers";
import Script from "next/script";
import { isAdminContext } from "../../lib/stackscout-server.js";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "StackScout - Stats",
};

export default async function StatsPage({ searchParams }) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const headerStore = await headers();
  const allowed = isAdminContext({
    queryToken: params?.admin_token,
    cookieToken: cookieStore.get("stackscout_admin")?.value,
    headerToken: headerStore.get("x-admin-token"),
  });

  if (!allowed) {
    return <main className="app"><p className="data-status">Admin token required</p></main>;
  }

  return (
    <>
      <main className="app">
        <section className="toolbar stats-toolbar" aria-labelledby="stats-title">
          <div>
            <p className="eyebrow">Private MVP analytics</p>
            <h1 id="stats-title" className="brand-heading stats-brand">
              <img src="/assets/stackscout-logo.svg" alt="StackScout" width="920" height="220" />
              <span>Stats</span>
            </h1>
            <p className="summary">Outbound click signals for retailer value, category interest, and stack intent.</p>
            <p className="data-status" id="stats-status">Loading stats...</p>
          </div>
        </section>

        <section className="stats-grid" aria-label="Stats summary">
          <article className="stat-card"><span>Raw clicks</span><strong id="stat-total">0</strong><p>Last 30 days</p></article>
          <article className="stat-card"><span>Credible clicks</span><strong id="stat-credible">0</strong><p>Deduped buyer intent</p></article>
          <article className="stat-card"><span>Duplicates</span><strong id="stat-duplicates">0</strong><p>Repeat clicks filtered</p></article>
          <article className="stat-card"><span>Last 7 days</span><strong id="stat-7">0</strong><p>Credible buyer-intent clicks</p></article>
          <article className="stat-card"><span>Page views</span><strong id="stat-page-views">0</strong><p>First-party sessions</p></article>
          <article className="stat-card"><span>Stack adds</span><strong id="stat-stack-adds">0</strong><p>Saved product intent</p></article>
        </section>

        <section className="stats-panels" aria-label="Analytics breakdowns">
          <article className="stats-panel stats-panel-wide"><h2>Retailer by category</h2><div id="stats-retailer-categories"></div></article>
          <article className="stats-panel"><h2>Top retailers</h2><div id="stats-retailers"></div></article>
          <article className="stats-panel"><h2>Top products</h2><div id="stats-products"></div></article>
          <article className="stats-panel"><h2>Categories</h2><div id="stats-categories"></div></article>
          <article className="stats-panel"><h2>Click locations</h2><div id="stats-locations"></div></article>
          <article className="stats-panel"><h2>Product events</h2><div id="stats-events"></div></article>
          <article className="stats-panel"><h2>Event categories</h2><div id="stats-event-categories"></div></article>
        </section>

        <section className="stats-panel" aria-label="Recent outbound clicks">
          <h2>Recent clicks</h2>
          <div id="stats-recent"></div>
        </section>
      </main>
      <Script src="/src/stats.js?v=next-migration-1" strategy="afterInteractive" />
    </>
  );
}
