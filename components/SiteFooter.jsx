const footerLinks = [
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/disclaimer", label: "Disclaimer" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <a className="footer-brand" href="/">StackScout</a>
        <p>NZ supplement price comparison. Final prices and availability are confirmed by retailers.</p>
      </div>
      <nav aria-label="Footer">
        {footerLinks.map((link) => (
          <a key={link.href} href={link.href}>{link.label}</a>
        ))}
      </nav>
      <a className="footer-email" href="mailto:rob.overtime.ai@gmail.com">rob.overtime.ai@gmail.com</a>
    </footer>
  );
}
