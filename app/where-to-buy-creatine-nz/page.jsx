import { IntentComparisonPage } from "../../components/IntentComparisonPage.jsx";
import { intentPages, pageMetadata } from "../../lib/seo.js";

const page = intentPages["where-to-buy-creatine-nz"];

export const dynamic = "force-dynamic";
export const metadata = pageMetadata(page);

export default async function WhereToBuyCreatineNzPage() {
  return <IntentComparisonPage page={page} />;
}
