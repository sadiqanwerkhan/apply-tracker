import { StatusFilter } from "@/lib/types";

type Props = {
  active: StatusFilter;
  counts: Record<StatusFilter, number>;
  scanning: boolean;
  onChange: (s: StatusFilter) => void;
};

const OPTIONS: StatusFilter[] = ["All", "Advancing", "Pending", "Rejected"];

export default function FilterPills({ active, counts, scanning, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {OPTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          disabled={scanning}
          className={`px-4 py-2 rounded-full text-sm font-medium transition border ${
            active === s
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
          } ${scanning ? "opacity-50" : ""}`}
        >
          {s} <span className="opacity-60">({scanning ? "…" : counts[s]})</span>
        </button>
      ))}
    </div>
  );
}
