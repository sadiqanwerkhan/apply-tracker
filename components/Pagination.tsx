import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
};

export default function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  const btn =
    "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-foreground/80";

  return (
    <div className="mt-6 flex items-center justify-center gap-4">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} className={btn}>
        <ChevronLeft className="size-3.5" />
        Previous
      </button>
      <span className="tnum text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages} className={btn}>
        Next
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  );
}
