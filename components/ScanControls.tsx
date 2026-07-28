type Props = {
  startDate: string;
  endDate: string;
  scanning: boolean;
  error: string;
  progress: { processed: number; remaining: number } | null;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  onScan: () => void;
};
import Button from "@/components/ui/Button";

export default function ScanControls({ startDate, endDate, scanning, error, progress, onStart, onEnd, onScan }: Props) {
  const total = progress ? progress.processed + progress.remaining : 0;
  const pct = total > 0 ? Math.round((progress!.processed / total) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input type="date" value={startDate} onChange={(e) => onStart(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input type="date" value={endDate} onChange={(e) => onEnd(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700" />
        </div>
        <Button onClick={onScan} disabled={scanning} loading={scanning} variant="primary" size="md">
          {scanning ? "Scanning…" : "Scan my applications"}
        </Button>
      </div>

      {scanning && progress && total > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Processing your inbox…</span>
            <span>{progress.processed} of {total} emails</span>
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
    </div>
  );
}