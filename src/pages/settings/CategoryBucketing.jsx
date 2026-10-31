import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Search, X } from "lucide-react";
import { useExpenseContext } from "../../context/ExpenseContext";
import ConfirmButton from "../../components/ConfirmButton";

const inputClass =
  "border border-border rounded-md px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none";

function BucketRow({ bucket, count, onRename, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bucket.name);

  const save = async () => {
    if (name.trim() && name.trim() !== bucket.name) await onRename(bucket.id, name);
    setEditing(false);
  };

  return (
    <li className="flex items-center justify-between gap-2 py-2">
      {editing ? (
        <form
          className="flex items-center gap-1 flex-1 min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={`New name for ${bucket.name}`}
            className={`${inputClass} flex-1 min-w-0 py-1`}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setName(bucket.name);
                setEditing(false);
              }
            }}
          />
          <button type="submit" aria-label="Save name" className="p-1.5 rounded-md text-ledger-dark hover:bg-ledger-soft">
            <Check size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Cancel rename"
            onClick={() => {
              setName(bucket.name);
              setEditing(false);
            }}
            className="p-1.5 rounded-md text-ink-muted hover:bg-surface-sunken"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </form>
      ) : (
        <>
          <div className="min-w-0">
            <span className="text-sm font-medium text-ink break-words">{bucket.name}</span>
            <span className="text-xs text-ink-muted ml-2">
              {count} categor{count === 1 ? "y" : "ies"}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Rename ${bucket.name}`}
              className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken"
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
            <ConfirmButton
              onConfirm={() => onRemove(bucket.id)}
              className="text-sm text-alert px-2 py-1 rounded-md hover:bg-alert-soft"
              confirmClassName="text-sm text-white bg-alert px-2 py-1 rounded-md"
              confirmLabel="Remove?"
              title={`Remove "${bucket.name}"? Its categories become Unassigned.`}
            >
              Remove
            </ConfirmButton>
          </div>
        </>
      )}
    </li>
  );
}

const CategoryBucketing = () => {
  const { addBucket, renameBucket, removeBucket, assignToBucket, getBucketsWithCategories, cleanBucketAssignments, categories = [] } =
    useExpenseContext();

  const [buckets, setBuckets] = useState([]);
  const [newBucket, setNewBucket] = useState("");
  const [query, setQuery] = useState("");

  const load = async () => {
    const data = await getBucketsWithCategories();
    setBuckets(data.map((b) => ({ ...b, categories: b.categories || [] })));
  };

  useEffect(() => {
    (async () => {
      await cleanBucketAssignments();
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bucketOf = useMemo(() => {
    const map = new Map();
    for (const b of buckets) for (const c of b.categories) map.set(c, b.id);
    return map;
  }, [buckets]);

  // Unassigned first, then alphabetical.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...categories]
      .filter((c) => !q || c.toLowerCase().includes(q))
      .sort((a, b) => Number(bucketOf.has(a)) - Number(bucketOf.has(b)) || a.localeCompare(b));
  }, [categories, bucketOf, query]);

  const unassignedCount = categories.filter((c) => !bucketOf.has(c)).length;

  const handleAddBucket = async (e) => {
    e.preventDefault();
    if (!newBucket.trim()) return;
    await addBucket(newBucket.trim());
    setNewBucket("");
    load();
  };

  const handleAssign = async (category, bucketId) => {
    const current = bucketOf.get(category);
    if (!bucketId) {
      if (current != null) await assignToBucket(current, category); // toggles it off
    } else if (String(current) !== bucketId) {
      const target = buckets.find((b) => String(b.id) === bucketId);
      await assignToBucket(target.id, category);
    }
    load();
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-1">Category Bucketing</h2>
      <p className="text-sm text-ink-muted mb-4">Buckets group categories for analytics. Each category belongs to at most one bucket.</p>

      <section className="mb-6">
        <h3 className="text-sm font-semibold text-ink mb-2">Buckets</h3>
        <form className="flex flex-wrap gap-2 mb-2" onSubmit={handleAddBucket}>
          <input
            value={newBucket}
            onChange={(e) => setNewBucket(e.target.value)}
            placeholder="New bucket name"
            aria-label="New bucket name"
            className={`${inputClass} flex-1 min-w-0 sm:flex-none sm:w-60`}
          />
          <button type="submit" className="bg-ledger hover:bg-ledger-dark text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Add Bucket
          </button>
        </form>
        {buckets.length === 0 ? (
          <p className="text-ink-muted text-sm">No buckets yet. Add one above.</p>
        ) : (
          <ul className="divide-y divide-border">
            {buckets.map((bucket) => (
              <BucketRow
                key={bucket.id}
                bucket={bucket}
                count={bucket.categories.length}
                onRename={async (id, name) => {
                  await renameBucket(id, name);
                  load();
                }}
                onRemove={async (id) => {
                  await removeBucket(id);
                  load();
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-ink">
            Categories
            {unassignedCount > 0 && <span className="ml-2 text-xs font-medium text-warning">{unassignedCount} unassigned</span>}
          </h3>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories"
              aria-label="Search categories"
              className={`${inputClass} w-full pl-8`}
            />
          </div>
        </div>

        {categories.length === 0 ? (
          <p className="text-ink-muted text-sm">No categories yet - they appear once you log transactions.</p>
        ) : rows.length === 0 ? (
          <p className="text-ink-muted text-sm">No categories match “{query}”.</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg">
            {rows.map((cat) => {
              const current = bucketOf.get(cat);
              const id = `bucket-for-${cat}`;
              return (
                <li key={cat} className="flex items-center justify-between gap-3 px-3 py-2">
                  <label htmlFor={id} className="text-sm text-ink min-w-0 break-words">
                    {cat}
                  </label>
                  <select
                    id={id}
                    value={current != null ? String(current) : ""}
                    onChange={(e) => handleAssign(cat, e.target.value)}
                    disabled={buckets.length === 0}
                    className={`${inputClass} py-1.5 w-40 sm:w-48 shrink-0 ${current == null ? "text-warning" : ""}`}
                  >
                    <option value="">Unassigned</option>
                    {buckets.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default CategoryBucketing;
