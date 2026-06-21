type Props = {
  startDate: string;
  endDate: string;
  scanning: boolean;
  error: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  onScan: () => void;
};

export default function ScanControls({ startDate, endDate, scanning, error, onStart, onEnd, onScan }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStart(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEnd(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-700"
          />
        </div>
        <button
          onClick={onScan}
          disabled={scanning}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium px-6 py-2 rounded-lg transition"
        >
          {scanning ? "Scanning…" : "Scan my applications"}
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
    </div>
  );
}
