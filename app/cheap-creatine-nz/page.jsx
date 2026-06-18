import { IntentComparisonPage } from "../../components/IntentComparisonPage.jsx";
import { intentPages, pageMetadata } from "../../lib/seo.js";

const page = intentPages["cheap-creatine-nz"];

export const dynamic = "force-dynamic";
export const metadata = pageMetadata(page);

export default async function CheapCreatineNzPage() {
  return <IntentComparisonPage page={page} />;
}
