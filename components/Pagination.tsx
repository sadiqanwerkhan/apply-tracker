type Props = {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
};

export default function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 mt-6">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:border-gray-400 transition"
      >
        ← Previous
      </button>
      <span className="text-sm text-gray-500">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:border-gray-400 transition"
      >
        Next →
      </button>
    </div>
  );
}
