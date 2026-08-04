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
    <div className="flex w-fit items-center gap-1 rounded-xl bg-secondary/70 p-1">
      {OPTIONS.map((s) => {
        const isActive = active === s;
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            disabled={scanning}
            className={`relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
              isActive
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            } ${scanning ? "opacity-50" : ""}`}
          >
            <span className="flex items-center gap-1.5">
              {s}
              <span className={`tnum text-[11px] ${isActive ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                {scanning ? "…" : counts[s]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
