"use client"

import { cn } from "@ritorno/ui/lib/utils"
import { CheckIcon } from "lucide-react"
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react"

const STEP_MS = 420

export interface JourneyStep {
  label: string
  time: string
}

/**
 * The hub checklist: the server renders it finished (no JS, crawlers, reduced motion). On the client, while it is still
 * below the fold, it resets to empty and ticks the steps in one by one once it scrolls into view.
 */
export function JourneyChecklist({ steps, progress }: { steps: JourneyStep[]; progress: string[] }) {
  const ref = useRef<HTMLOListElement>(null)
  const [done, setDone] = useState(steps.length)

  useLayoutEffect(() => {
    const list = ref.current
    if (!list || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (list.getBoundingClientRect().top < window.innerHeight) return
    setDone(0)
  }, [])

  const finished = done === steps.length
  useEffect(() => {
    const list = ref.current
    if (!list || finished) return
    let timer: ReturnType<typeof setInterval> | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || timer) return
        observer.disconnect()
        timer = setInterval(() => setDone((n) => (n >= steps.length ? n : n + 1)), STEP_MS)
      },
      { threshold: 0.35 },
    )
    observer.observe(list)
    return () => {
      observer.disconnect()
      if (timer) clearInterval(timer)
    }
  }, [finished, steps.length])

  return (
    <>
      <ol ref={ref} className="grid">
        {steps.map((step, index) => {
          const state = index < done ? "done" : index === done ? "running" : "next"
          return (
            <li
              key={step.label}
              data-state={state}
              className="flex min-h-10 items-center gap-3 text-small transition-colors duration-300 data-[state=next]:text-muted-foreground"
            >
              <span
                className={cn(
                  "grid size-4.5 shrink-0 place-items-center rounded-full transition-colors duration-300",
                  state === "done" ? "bg-foreground/70 text-background" : "border border-foreground/25",
                  state === "running" && "animate-pulse border-blue-500",
                )}
              >
                {state === "done" ? <CheckIcon aria-hidden className="size-3" strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 flex-1 text-pretty">{step.label}</span>
              <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
                <bdi dir="ltr">{step.time}</bdi>
              </span>
            </li>
          )
        })}
      </ol>
      <div className="mt-4 h-0.5 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full origin-left scale-x-(--progress) bg-foreground transition-transform duration-300 ease-out rtl:origin-right"
          style={{ "--progress": done / steps.length } as CSSProperties}
        />
      </div>
      <p className="mt-2 text-caption text-muted-foreground" aria-live="off">
        {progress[done]}
      </p>
    </>
  )
}
