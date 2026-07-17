import { Skeleton } from "@/components/ui/skeleton";

export function InventoryCardSkeleton() {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b0e14] shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-white/[0.03]">
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          <Skeleton className="h-6 w-12 rounded-full" />
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-10">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3">
        <div className="grid grid-cols-3 overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="border-r border-white/[0.06] px-3 py-3 last:border-r-0 sm:px-4 sm:py-4"
            >
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="mt-2 h-5 w-16" />
            </div>
          ))}
        </div>

        <Skeleton className="h-4 w-full" />

        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>

        <div className="mt-auto flex gap-2 pt-1">
          <Skeleton className="h-10 flex-[1_1_75%] rounded-full" />
          <Skeleton className="h-10 flex-[1_1_25%] rounded-full" />
        </div>
      </div>
    </article>
  );
}
