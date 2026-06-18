import { IntentComparisonPage } from "../../components/IntentComparisonPage.jsx";
import { intentPages, pageMetadata } from "../../lib/seo.js";

const page = intentPages["best-creatine-nz"];

export const dynamic = "force-dynamic";
export const metadata = pageMetadata(page);

export default async function BestCreatineNzPage() {
  return <IntentComparisonPage page={page} />;
}
