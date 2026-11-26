import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
import { LOCALE_NAMES } from "@ritorno/i18n"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"

/** The guest language as three segments: one tap, keyboard and screen readers work for free. */
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
    <div className="grid gap-2">
      <span className="font-medium text-sm">{legend}</span>
      <SegmentedControl
        label={legend}
        name={name}
        block
        value={value}
        onValueChange={onChange}
        options={HOTEL_LANGUAGES.map((option) => ({ value: option, label: LOCALE_NAMES[option] }))}
      />
    </div>
  )
}
