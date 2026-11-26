import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
import { LOCALE_NAMES } from "@ritorno/i18n"

/** Three native radios dressed as big chips: one tap, keyboard and screen readers work for free. */
export function LanguageChoice({
  name,
  value,
  onChange,
  legend,
}: {
  name: string
  value: HotelLanguage
  onChange: (value: HotelLanguage) => void
  legend: string
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 font-medium text-sm">{legend}</legend>
      <div className="grid grid-cols-3 gap-2">
        {HOTEL_LANGUAGES.map((option) => (
          <label
            key={option}
            className="flex h-11 cursor-pointer items-center justify-center rounded-lg border border-input text-sm transition-colors duration-150 has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-surface"
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {LOCALE_NAMES[option]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
