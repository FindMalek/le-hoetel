"use client"

import { orpc } from "@ritorno/orpc/react"
import { useQueryClient } from "@tanstack/react-query"

/** After a guest or a case changed: every list that shows them is stale (names, consents, counts). */
export function useRefreshLists() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      [orpc.guests, orpc.messages, orpc.feedbackCases, orpc.offers].map((router) =>
        queryClient.invalidateQueries({ queryKey: router.key() }),
      ),
    )
}
