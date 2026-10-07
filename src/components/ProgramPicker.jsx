import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronRight,
  Clapperboard,
  Compass,
  Palette,
  PenTool,
} from 'lucide-react'
import { PROGRAMS, VISIBLE_CREATIVE_TECH_TRACKS } from '../lib/programs'
import { SCHEDULES } from '../lib/schedule'
import { useLang } from '../i18n/LanguageContext'

const TRACK_ICONS = { cc: Clapperboard, gd: PenTool }

/**
 * Two-step program picker, styled like the start-date prompt:
 *   1. Data Analytics  vs  Creative Tech
 *   2. (Creative Tech only) Content Creation  vs  Graphic Design
 * Week and module counts come straight from the bundled schedules.
 *
 * `headingRef` lets App move focus to the heading when the picker opens from
 * the hero's "change" (see App's takeStep).
 */
export default function ProgramPicker({ program, onSelect, onCancel, headingRef }) {
  const { t } = useLang()
  const hasCreativeTech = VISIBLE_CREATIVE_TECH_TRACKS.length > 0
  const inCreativeTech = Boolean(program) && PROGRAMS[program]?.family === 'creative-tech'
  // Re-opening the picker from a Creative Tech track lands on the track step if visible.
  const [step, setStep] = useState(inCreativeTech && hasCreativeTech ? 'creative-tech' : 'family')
  const onFamilyStep = step === 'family'

  /*
    Changing step swaps every option on the card, the one just pressed
    included, and focus fell to the page body: after "Creative Tech", or
    Back, a screen-reader user was sent to the top of the page. The heading
    takes focus instead and reads out the new question. Only on a change of
    step; the step a picker opens on is App's to announce, or not.
  */
  const ownHeading = useRef(null)
  const heading = headingRef ?? ownHeading
  const shownStep = useRef(step)
  useEffect(() => {
    if (shownStep.current === step) return
    shownStep.current = step
    heading.current?.focus()
  }, [step, heading])

  const meta = (id) => t.programMeta(SCHEDULES[id].totalWeeks, SCHEDULES[id].modules.length)
  const HeaderIcon = onFamilyStep ? Compass : Palette

  return (
    <section className="alx-card border-cobalt/25 text-center" aria-labelledby="program-picker-title">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cobalt/10 text-cobalt-600 dark:bg-lime/15 dark:text-lime">
        <HeaderIcon size={28} strokeWidth={2.25} aria-hidden="true" />
      </div>
      <h2 id="program-picker-title" ref={heading} tabIndex={-1} className="text-lg font-bold">
        {onFamilyStep ? t.pickerTitle : t.pickerTrackTitle}
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft dark:text-paper/75">
        {onFamilyStep ? t.pickerBody : t.pickerTrackBody}
      </p>

      <div className="mx-auto mt-4 flex max-w-sm flex-col gap-2">
        {onFamilyStep ? (
          <>
            <ProgramOption
              Icon={BarChart3}
              title={t.programs.da}
              meta={meta('da')}
              selected={program === 'da'}
              selectedLabel={t.selected}
              onClick={() => onSelect('da')}
            />
            {hasCreativeTech && (
              <ProgramOption
                Icon={Palette}
                title={t.creativeTech}
                meta={t.creativeTechMeta}
                selected={inCreativeTech}
                selectedLabel={t.selected}
                onClick={() => setStep('creative-tech')}
                opensStep
              />
            )}
          </>
        ) : (
          VISIBLE_CREATIVE_TECH_TRACKS.map((id) => (
            <ProgramOption
              key={id}
              Icon={TRACK_ICONS[id] || Palette}
              title={t.programs[id]}
              meta={meta(id)}
              selected={program === id}
              selectedLabel={t.selected}
              onClick={() => onSelect(id)}
            />
          ))
        )}
      </div>

      {(!onFamilyStep || onCancel) && (
        <div className="mt-2 flex items-center justify-center gap-2">
          {!onFamilyStep && (
            <button
              type="button"
              onClick={() => setStep('family')}
              className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-semibold text-cobalt-600 hover:underline dark:text-lime"
            >
              <ArrowLeft size={14} className="rtl:rotate-180" aria-hidden="true" />
              {t.back}
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-[44px] items-center px-3 text-xs font-semibold text-ink-mute hover:underline dark:text-paper/65"
            >
              {t.cancel}
            </button>
          )}
        </div>
      )}

      {program && hasCreativeTech && <p className="mt-1 text-[11px] text-ink-mute dark:text-paper/60">{t.pickerSwitchNote}</p>}
    </section>
  )
}

function ProgramOption({ Icon, title, meta, selected, selectedLabel, onClick, opensStep = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap-target flex w-full items-center gap-3 rounded-xl border-2 p-3 text-start transition-colors ${
        selected
          ? 'border-lime bg-lime/10 dark:bg-lime/5'
          : 'border-navy-900/10 hover:border-cobalt dark:border-white/15 dark:hover:border-lime'
      }`}
    >
      <span
        className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${
          selected
            ? 'bg-lime text-navy-900'
            : 'bg-cobalt/10 text-cobalt-600 dark:bg-lime/15 dark:text-lime'
        }`}
      >
        <Icon size={20} strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-tight">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-soft dark:text-paper/70">{meta}</span>
      </span>
      {selected && (
        <>
          <Check
            size={18}
            strokeWidth={3}
            className="flex-none text-alxgreen-700 dark:text-lime"
            aria-hidden="true"
          />
          <span className="sr-only">{selectedLabel}</span>
        </>
      )}
      {opensStep && (
        <ChevronRight
          size={18}
          className="flex-none text-ink-mute rtl:rotate-180 dark:text-paper/60"
          aria-hidden="true"
        />
      )}
    </button>
  )
}
