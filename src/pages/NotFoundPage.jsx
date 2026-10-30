import { Link } from "react-router-dom";

export default function NotFoundPage() {
    return (
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
            <h1 className="font-display text-2xl text-ink mb-2">Page not found</h1>
            <p className="text-sm text-ink-muted mb-6">There's nothing at this address.</p>
            <Link to="/" className="text-ledger-dark hover:underline">
                Go to Home
            </Link>
        </div>
    );
}
