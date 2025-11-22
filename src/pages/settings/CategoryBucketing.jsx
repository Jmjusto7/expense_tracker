import { useEffect, useState } from "react";
import { useExpenseContext } from "../../context/ExpenseContext";

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
      await cleanBucketAssignments(categories); // remove invalid category assignments
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
    <div className="max-w-3xl mx-auto p-4">
      <h2 className="text-xl font-semibold mb-4">Category Bucketing</h2>

      {/* Add new bucket */}
      <div className="flex gap-2 mb-4">
        <input
          value={newBucket}
          onChange={(e) => setNewBucket(e.target.value)}
          placeholder="New bucket name"
          className="border p-2 rounded w-60"
        />
        <button
          onClick={handleAddBucket}
          className="bg-indigo-500 text-white px-4 py-2 rounded"
        >
          Add Bucket
        </button>
      </div>

      {/* Bucket list */}
      {buckets.length === 0 ? (
        <p className="text-gray-500">No buckets yet. Add a bucket above.</p>
      ) : (
        buckets.map((bucket) => (
          <div key={bucket.id} className="p-4 border rounded mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">{bucket.name}</h3>
              <button
                onClick={() => removeBucket(bucket.id).then(load)}
                className="text-red-500"
              >
                Remove
              </button>
            </div>

            {categories.length === 0 ? (
              <p className="text-gray-400 text-sm">No categories available.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
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
                          h-4 w-4 rounded border
                          flex items-center justify-center
                          ${
                            assignedToThisBucket
                              ? "bg-blue-500 border-blue-600"
                              : assignedToOtherBucket
                              ? "bg-gray-400 border-gray-500"
                              : "bg-white border-gray-400"
                          }
                        `}
                      >
                        {assignedToThisBucket && (
                          <div className="w-2 h-2 bg-white rounded-sm"></div>
                        )}
                      </div>

                      <span
                        className={
                          assignedToOtherBucket && !assignedToThisBucket
                            ? "text-gray-400"
                            : ""
                        }
                      >
                        {cat}
                      </span>
                    </label>
                  );
                })}

              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default CategoryBucketing;
