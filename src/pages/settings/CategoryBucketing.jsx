import { useEffect, useState } from "react";
import { useExpenseContext } from "../../context/ExpenseContext";
import ConfirmButton from "../../components/ConfirmButton";

const CategoryBucketing = () => {
  const {
    addBucket,
    removeBucket,
    assignToBucket,
    getBucketsWithCategories,
    cleanBucketAssignments,
    categories = [],
  } = useExpenseContext();

  const [buckets, setBuckets] = useState([]);
  const [newBucket, setNewBucket] = useState("");

  // Load buckets and their assigned categories
  const load = async () => {
    const data = await getBucketsWithCategories();
    // Ensure each bucket has a categories array
    const safeData = data.map((b) => ({ ...b, categories: b.categories || [] }));
    setBuckets(safeData);
  };

  useEffect(() => {
    const init = async () => {
      await cleanBucketAssignments(); // remove invalid category assignments
      await load();                   // then load buckets with updated assignments
    };

    init();
  }, []);


  const handleAddBucket = async () => {
    if (!newBucket.trim()) return;
    await addBucket(newBucket.trim());
    setNewBucket("");
    load();
  };

  const handleAssign = async (bucketId, category) => {
    await assignToBucket(bucketId, category);
    load();
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-ink mb-4">Category Bucketing</h2>

      {/* Add new bucket */}
      <div className="flex gap-2 mb-5">
        <input
          value={newBucket}
          onChange={(e) => setNewBucket(e.target.value)}
          placeholder="New bucket name"
          className="border border-border rounded-md px-3 py-2 w-60 bg-surface focus:ring-2 focus:ring-ledger focus:outline-none"
        />
        <button
          onClick={handleAddBucket}
          className="bg-ledger hover:bg-ledger-dark text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          Add Bucket
        </button>
      </div>

      {/* Bucket list */}
      {buckets.length === 0 ? (
        <p className="text-ink-muted text-sm">No buckets yet. Add a bucket above.</p>
      ) : (
        <div className="space-y-4">
          {buckets.map((bucket) => (
            <div key={bucket.id} className="p-4 border border-border rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-medium text-ink">{bucket.name}</h3>
                <ConfirmButton
                  onConfirm={() => removeBucket(bucket.id).then(load)}
                  className="text-sm text-alert hover:underline"
                  confirmClassName="text-sm text-white bg-alert px-2 py-0.5 rounded-md"
                  confirmLabel="Confirm remove?"
                  title={`Remove "${bucket.name}"? Its categories become Unassigned.`}
                >
                  Remove
                </ConfirmButton>
              </div>

              {categories.length === 0 ? (
                <p className="text-ink-muted text-sm">No categories available.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {categories.map((cat) => {
                    const assignedToThisBucket = bucket.categories?.includes(cat) ?? false;

                    const assignedToOtherBucket = buckets.some(
                      (b) => b.id !== bucket.id && b.categories?.includes(cat)
                    );

                    return (
                      <label
                        key={cat}
                        className="flex items-center gap-2 p-1 rounded cursor-pointer"
                        onClick={() => handleAssign(bucket.id, cat)}
                      >
                        {/* HIDDEN REAL CHECKBOX */}
                        <input type="checkbox" className="hidden" checked={assignedToThisBucket} readOnly />

                        {/* CUSTOM BOX */}
                        <div
                          className={`
                            h-4 w-4 rounded border shrink-0
                            flex items-center justify-center
                            ${
                              assignedToThisBucket
                                ? "bg-ledger border-ledger-dark"
                                : assignedToOtherBucket
                                ? "bg-ink-muted/40 border-ink-muted/60"
                                : "bg-surface border-border"
                            }
                          `}
                        >
                          {assignedToThisBucket && (
                            <div className="w-2 h-2 bg-white rounded-sm"></div>
                          )}
                        </div>

                        <span
                          className={`text-sm ${
                            assignedToOtherBucket && !assignedToThisBucket
                              ? "text-ink-muted/60"
                              : "text-ink"
                          }`}
                        >
                          {cat}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryBucketing;
