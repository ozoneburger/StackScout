import { ContentPage } from "../../components/ContentPage.jsx";

export const metadata = {
  title: "Privacy - StackScout",
};

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow="Privacy"
      title="Privacy"
      summary="This page explains what StackScout collects, why it is collected, and how to contact us about it."
    >
      <p className="content-note">Last updated: 13 June 2026. This is a practical privacy summary, not legal advice.</p>

      <h2>Information you provide</h2>
      <p>
        If you send feedback or contact StackScout, we may collect the message, feedback type, product or retailer name, source URL, page path, and any contact details you include.
      </p>

      <h2>Information collected automatically</h2>
      <p>
        StackScout records first-party usage events such as page views, category changes, sort/filter changes, stack actions, and outbound clicks to retailer pages. These events can include page path, product source URL, click location, category, a browser session ID, and a hashed request identifier used for rate limiting and duplicate detection.
      </p>

      <h2>Browser storage</h2>
      <p>
        StackScout uses session storage for a temporary session ID and local storage for your saved stack. This keeps the comparison tool working in your browser. You can clear this through your browser settings.
      </p>

      <h2>Why this information is used</h2>
      <p>
        The information is used to operate the site, prevent abuse, understand which comparisons are useful, fix product data issues, and respond to enquiries.
      </p>

      <h2>Sharing</h2>
      <p>
        StackScout does not sell personal information. Data may be processed by hosting, database, analytics, email, and infrastructure providers needed to run the site.
      </p>

      <h2>Access and correction</h2>
      <p>
        You can ask to access or correct personal information associated with you by emailing <a href="mailto:rob.overtime.ai@gmail.com">rob.overtime.ai@gmail.com</a>. You may need to provide enough detail to identify the relevant message or record.
      </p>
    </ContentPage>
  );
}
