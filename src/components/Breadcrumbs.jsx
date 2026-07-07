import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

// items: [{ label, to? }] - the last item (current page) should omit `to`.
export default function Breadcrumbs({ items }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm mb-4 flex-wrap">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={12} className="text-ink-muted/50" />}
          {item.to ? (
            <Link to={item.to} className="text-ink-muted hover:text-ink transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
