"use client"

import { useState } from "react"

type Errors<V> = Partial<Record<keyof V, string>>

/** Values, blur-time validation and a submit gate: an error shows once a field was left, or after a failed submit. */
export function useForm<V extends Record<string, unknown>>(initial: V, validate: (values: V) => Errors<V>) {
  const [values, setValues] = useState<V>(initial)
  const [touched, setTouched] = useState<Partial<Record<keyof V, boolean>>>({})
  const errors = validate(values)

  return {
    values,
    set: <K extends keyof V>(key: K, value: V[K]) => setValues((current) => ({ ...current, [key]: value })),
    blur: (key: keyof V) => setTouched((current) => ({ ...current, [key]: true })),
    error: (key: keyof V): string | undefined => (touched[key] ? errors[key] : undefined),
    /** Marks every field as seen and tells whether the form can be sent. */
    submit: (): boolean => {
      setTouched(Object.fromEntries(Object.keys(values).map((key) => [key, true])) as Partial<Record<keyof V, boolean>>)
      return Object.keys(errors).length === 0
    },
    reset: (next: V) => {
      setValues(next)
      setTouched({})
    },
  }
}
