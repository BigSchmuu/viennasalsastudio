import { Skeleton } from "@/components/ui/skeleton";

export default function KurseLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Skeleton className="h-16 w-[180px]" />
        <Skeleton className="h-16 w-[180px]" />
        <Skeleton className="h-16 w-[180px]" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
