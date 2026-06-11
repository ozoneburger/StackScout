import { supabaseRequest } from "../scripts/supabase-history.js";
import { readProductDataset } from "./stackscout-server.js";

let activeRefresh = null;

function env() {
  return {
    refreshMs: Number(process.env.REFRESH_MS ?? 24 * 60 * 60 * 1000),
    isVercel: process.env.VERCEL === "1",
  };
}

function refreshStatePayload() {
  return {
    running: Boolean(activeRefresh),
    lastRefresh: globalThis.__stackscoutLastRefreshSummary ?? null,
  };
}

async function createRefreshRun(reason) {
  try {
    const rows = await supabaseRequest("/refresh_runs", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        reason,
        status: "running",
        metadata: {
          refreshIntervalMs: env().refreshMs,
        },
      }),
    });
    return rows?.[0]?.id ?? null;
  } catch (error) {
    console.warn(`Refresh run tracking unavailable: ${error.message}`);
    return null;
  }
}

async function finishRefreshRun(id, row) {
  if (!id) return;
  try {
    await supabaseRequest(`/refresh_runs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        ...row,
        finished_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.warn(`Refresh run update failed: ${error.message}`);
  }
}

async function refreshSafely(reason) {
  const runId = await createRefreshRun(reason);
  try {
    const [{ discoverProducts }, { refreshProducts }] = await Promise.all([
      import("../scripts/discover-products.js"),
      import("../scripts/fetch-products.js"),
    ]);
    const seedProducts = env().isVercel ? (await readProductDataset()).products : null;
    const discovery = await discoverProducts({ products: seedProducts, writeCache: !env().isVercel });
    const result = await refreshProducts({ products: discovery.products, writeCache: !env().isVercel });
    const failedRetailers = (discovery.retailers ?? []).filter((retailer) => retailer.error);
    globalThis.__stackscoutLastRefreshSummary = {
      ok: true,
      reason,
      checkedAt: new Date().toISOString(),
      discovered: discovery.added,
      failedRetailers: failedRetailers.length,
      discoverySupabase: discovery.supabase,
      total: result.total,
      live: result.live,
      supabase: result.supabase,
    };
    await finishRefreshRun(runId, {
      status: "success",
      discovered_count: discovery.added,
      total_products: result.total,
      live_products: result.live,
      history_rows: result.supabase.historyRows ?? 0,
      availability_rows: result.supabase.availabilityRows ?? 0,
      supabase_enabled: result.supabase.enabled === true,
      error_message: result.supabase.error ?? null,
      metadata: {
        discoverySupabase: discovery.supabase,
        failedRetailers,
      },
    });
    return globalThis.__stackscoutLastRefreshSummary;
  } catch (error) {
    globalThis.__stackscoutLastRefreshSummary = {
      ok: false,
      reason,
      checkedAt: new Date().toISOString(),
      error: error.message,
    };
    await finishRefreshRun(runId, {
      status: "failed",
      error_message: error.message,
    });
    console.error(`[${new Date().toISOString()}] ${reason}: refresh failed`, error);
    return globalThis.__stackscoutLastRefreshSummary;
  }
}

export async function runRefreshNow(reason) {
  if (activeRefresh) {
    return { started: false, error: "Refresh already running", ...refreshStatePayload() };
  }
  activeRefresh = refreshSafely(reason).finally(() => {
    activeRefresh = null;
  });
  const result = await activeRefresh;
  return { started: true, running: false, lastRefresh: result };
}
