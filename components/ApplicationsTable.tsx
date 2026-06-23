import { Row } from "@/lib/types";

type Props = {
  items: Row[];
  scanning: boolean;
  emptyMessage?: string;
};

function statusClasses(status: string) {
  if (status === "Advancing") return "bg-green-100 text-green-700";
  if (status === "Rejected") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-gray-100">
          <td className="py-4 px-3"><div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: "70%" }} /></td>
          <td className="py-4 px-3"><div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: "85%" }} /></td>
          <td className="py-4 px-3"><div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" /></td>
          <td className="py-4 px-3"><div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: "70%" }} /></td>
          <td className="py-4 px-3"><div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: "70%" }} /></td>
          <td className="py-4 px-3"><div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: "60%" }} /></td>
        </tr>
      ))}
    </>
  );
}

export default function ApplicationsTable({ items, scanning, emptyMessage = "No applications match your filters." }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-3 px-3 font-medium">Company</th>
            <th className="py-3 px-3 font-medium">Role</th>
            <th className="py-3 px-3 font-medium">Status</th>
            <th className="py-3 px-3 font-medium">Applied</th>
            <th className="py-3 px-3 font-medium">Last update</th>
            <th className="py-3 px-3 font-medium">Latest subject</th>
          </tr>
        </thead>
        <tbody>
          {scanning ? (
            <SkeletonRows />
          ) : (
            items.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-3 font-medium text-gray-900">{r.company}</td>
                <td className="py-3 px-3 text-gray-600">{r.role || "—"}</td>
                <td className="py-3 px-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClasses(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td className="py-3 px-3 text-gray-500">{r.firstSeen}</td>
                <td className="py-3 px-3 text-gray-500">{r.lastSeen}</td>
                <td className="py-3 px-3 text-gray-400 text-xs max-w-xs truncate">{r.note || "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {!scanning && items.length === 0 && (
        <p className="text-center text-gray-400 py-8">{emptyMessage}</p>
      )}
    </div>
  );
}
