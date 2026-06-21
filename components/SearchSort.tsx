type Props = {
  search: string;
  sortBy: string;
  scanning: boolean;
  onSearch: (v: string) => void;
  onSort: (v: string) => void;
};

export default function SearchSort({ search, sortBy, scanning, onSearch, onSort }: Props) {
  return (
    <div className="flex flex-wrap gap-3 mb-5">
      <input
        type="text"
        placeholder="Search company…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        disabled={scanning}
        className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-4 py-2 text-gray-700 disabled:bg-gray-50"
      />
      <select
        value={sortBy}
        onChange={(e) => onSort(e.target.value)}
        disabled={scanning}
        className="border border-gray-300 rounded-lg px-4 py-2 text-gray-700 disabled:bg-gray-50"
      >
        <option value="date-desc">Newest first</option>
        <option value="date-asc">Oldest first</option>
        <option value="company-asc">Company A–Z</option>
      </select>
    </div>
  );
}
