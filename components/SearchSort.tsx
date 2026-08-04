import { Search, ChevronDown } from "lucide-react";

type Props = {
  search: string;
  sortBy: string;
  scanning: boolean;
  onSearch: (v: string) => void;
  onSort: (v: string) => void;
};

export default function SearchSort({ search, sortBy, scanning, onSearch, onSort }: Props) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="relative flex min-w-[200px] flex-1 items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search company…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          disabled={scanning}
          className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-accent focus:ring-4 focus:ring-accent/12 disabled:opacity-50"
        />
      </div>
      <div className="relative">
        <select
          value={sortBy}
          onChange={(e) => onSort(e.target.value)}
          disabled={scanning}
          className="h-10 appearance-none rounded-lg border border-input bg-background pl-3 pr-9 text-[13px] font-medium text-foreground outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent/12 disabled:opacity-50"
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="company-asc">Company A–Z</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}
