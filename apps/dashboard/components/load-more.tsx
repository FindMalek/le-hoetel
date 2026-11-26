"use client"

import { Button } from "@ritorno/ui/components/button"
import { useTranslations } from "next-intl"
import { useEffect, useRef } from "react"

type LoadMoreProps = {
  /** The parts of a `useInfiniteQuery` result it needs. */
  query: {
    hasNextPage: boolean
    isFetching: boolean
    isFetchingNextPage: boolean
    isFetchNextPageError: boolean
    fetchNextPage: () => unknown
  }
  shown: number
  total?: number
}

/** Infinite scroll: loads when it nears the screen. The button is for keyboards and for retrying. */
export function LoadMore({ query, shown, total }: LoadMoreProps) {
  const t = useTranslations("loadMore")
  const box = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetching, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query
  // Re-observing after a fetch fires again while the end is still on screen. An error waits for the button.
  const auto = hasNextPage && !isFetching && !isFetchNextPageError

  useEffect(() => {
    if (!auto || !box.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        observer.disconnect()
        fetchNextPage()
      },
      { rootMargin: "0px 0px 400px 0px" },
    )
    observer.observe(box.current)
    return () => observer.disconnect()
  }, [auto, fetchNextPage])

  if (!shown) return null
  return (
    <div ref={box} className="flex flex-col items-center gap-3 text-muted-foreground text-small">
      {isFetchNextPageError ? (
        <p role="alert" className="text-destructive">
          {t("failed")}
        </p>
      ) : null}
      {hasNextPage ? (
        <Button
          variant="outline"
          className="coarse:h-11 max-sm:w-full"
          loading={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {t(isFetchNextPageError ? "retry" : "more")}
        </Button>
      ) : null}
      <p aria-live="polite" className="tabular-nums">
        {total === undefined ? null : t("shown", { shown, total })}
      </p>
    </div>
  )
}
