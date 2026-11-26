import { notFound } from "next/navigation"

/** Unknown signed-in paths render `(app)/not-found.tsx` inside the shell instead of the bare root 404. */
export default function MissingPage(): never {
  notFound()
}
