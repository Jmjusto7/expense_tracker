import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Plus, Plane } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import AddTravelModal from "../components/AddTravelModal";
import EditTravelModal from "../components/EditTravelModal";
import CardActions from "../components/CardActions";
import { formatDate } from "../utils/dateHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import { filterTransactionsByTravel, sumAmounts, groupTravelsByYear } from "../utils/travelHelpers";

export default function TravelsPage() {
    const { travels, allTransactions, removeTravel } = useExpenseContext();

    const [showAddModal, setShowAddModal] = useState(false);
    const [editTravelId, setEditTravelId] = useState(null);

    const totalById = useMemo(
        () => new Map(travels.map((t) => [t.id, sumAmounts(filterTransactionsByTravel(allTransactions, t.id))])),
        [travels, allTransactions]
    );
    const { pinned, years } = useMemo(() => groupTravelsByYear(travels), [travels]);

    const renderCard = (travel) => (
        <div
            key={travel.id}
            className="group relative bg-surface rounded-lg border border-border hover:border-travel focus-within:border-travel p-5 transition-colors"
        >
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <Plane size={15} className="text-travel-dark shrink-0" aria-hidden="true" />
                    <h3 className="text-lg font-semibold text-ink truncate" title={travel.title}>
                        <Link
                            to={`/travels/${travel.id}`}
                            className="focus-visible:outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-travel"
                        >
                            {travel.title}
                        </Link>
                    </h3>
                </div>
                <CardActions
                    label={travel.title}
                    onEdit={() => setEditTravelId(travel.id)}
                    onDelete={() => removeTravel(travel.id)}
                    deleteTitle="Delete travel? Its expenses are kept, just untagged."
                />
            </div>

            <div className="text-sm text-ink-muted mb-3">
                {formatDate(travel.startDate)} – {formatDate(travel.endDate)}
            </div>
            <div className="money text-xl font-bold text-travel-dark">{formatCurrency(totalById.get(travel.id) ?? 0)}</div>
            {travel.comments && (
                <p className="text-sm text-ink-muted border-t border-border pt-3 mt-3 line-clamp-2" title={travel.comments}>
                    {travel.comments}
                </p>
            )}
        </div>
    );

    const section = (key, title, list, extra = null) => (
        <section key={key} className="mb-8" aria-labelledby={`travel-section-${key}`}>
            <div className="flex items-baseline justify-between gap-2 mb-3">
                <h2 id={`travel-section-${key}`} className="text-lg font-semibold text-ink">
                    {title}
                </h2>
                {extra}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{list.map(renderCard)}</div>
        </section>
    );

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
                <h1 className="font-display text-2xl text-ink">Travels</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-travel hover:bg-travel-dark text-white px-4 py-2 rounded-lg transition-colors"
                >
                    <Plus size={16} aria-hidden="true" />
                    Add Travel
                </button>
            </div>

            {travels.length === 0 && <p className="text-ink-muted">No travels created yet.</p>}

            {pinned.length > 0 && section("current", "Current & upcoming", pinned)}

            {years.map(({ year, travels: list }) =>
                section(
                    year,
                    String(year),
                    list,
                    <span className="money text-sm text-ink-muted">
                        {list.length} trip{list.length === 1 ? "" : "s"} ·{" "}
                        {formatCurrency(list.reduce((sum, t) => sum + (totalById.get(t.id) ?? 0), 0))}
                    </span>
                )
            )}

            {showAddModal && <AddTravelModal onClose={() => setShowAddModal(false)} />}
            {editTravelId && <EditTravelModal travelId={editTravelId} onClose={() => setEditTravelId(null)} />}
        </div>
    );
}
