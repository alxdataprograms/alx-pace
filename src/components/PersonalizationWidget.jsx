import { useEffect, useRef, useState } from 'react'
import {
  CalendarCheck,
  CalendarDays,
  Check,
  Flame,
  GraduationCap,
  Pencil,
  Rocket,
  X,
} from 'lucide-react'
import { sloganForWeek } from '../lib/slogans'
import { PROGRAMS } from '../lib/programs'
import { plannedEndDate, toISODateString } from '../lib/pacing'
import { formatHumanDate } from '../lib/formatDate'
import { useLang } from '../i18n/LanguageContext'

import portrait1 from '../assets/alx/banner-img1.webp'
import portrait2 from '../assets/alx/banner-img2.webp'
import portrait3 from '../assets/alx/banner-img3.webp'
import portrait4 from '../assets/alx/banner-img4.webp'
import portrait5 from '../assets/alx/banner-img5.webp'

const PORTRAITS = [portrait1, portrait2, portrait3, portrait4, portrait5]

/**
 * Top personalization widget styled after the alxafrica.com hero banner:
 * deep navy panel, lime accent, duotone learner portraits. Name, program and
 * start date are tap-to-edit without resetting progress.
 *
 * Drafts are seeded when an editor OPENS (not synced from props), so an
 * external update — cross-tab sync, reset — can never clobber in-flight typing.
 */
export default function PersonalizationWidget({
  learnerName,
  startDate,
  pacing,
  schedule,
  program,
  programName,
  onUpdateName,
  onUpdateStartDate,
  onChangeProgram,
}) {
  const { t, lang } = useLang()
  const [editingName, setEditingName] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [dateDraft, setDateDraft] = useState('')
  const nameInputRef = useRef(null)

  // Focus management only — draft seeding happens in the open handlers.
  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }
  }, [editingName])

  const openNameEditor = () => {
    setNameDraft(learnerName)
    setEditingName(true)
  }
  const openDateEditor = () => {
    setDateDraft(startDate)
    setEditingDate(true)
  }

  const commitName = () => {
    onUpdateName(nameDraft)
    setEditingName(false)
  }
  const commitDate = () => {
    onUpdateStartDate(dateDraft)
    setEditingDate(false)
  }

  // Creative Tech tracks name their family too; Data Analytics is its own family.
  const familyName = PROGRAMS[program]?.family === 'creative-tech' ? t.creativeTech : ''

  const week = pacing.currentWeek
  const slogan = sloganForWeek(week, lang, program)
  const showWeekLine = pacing.status === 'active'

  const todayIso = toISODateString(new Date())
  const isPlaceholderName = !learnerName?.trim()
  // Live-preview the finish date from whichever date is relevant right now.
  const finishDate = schedule
    ? plannedEndDate(editingDate ? dateDraft : startDate, schedule.totalDays)
    : null

  return (
    <section
      className="relative overflow-hidden rounded-2xl bg-navy-900 p-5 text-paper shadow-card"
      aria-label="ALX Pace"
    >
      {/* Brand glows, echoing the site hero */}
      <div
        className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-cobalt/30 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-12 -start-8 h-36 w-36 rounded-full bg-lime/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative">
        {/* Greeting + name */}
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              ref={nameInputRef}
              value={nameDraft}
              maxLength={40}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') setEditingName(false)
              }}
              className="w-full rounded-xl border border-white/25 bg-white/10 px-3 py-1.5 text-lg font-bold text-white placeholder-white/40 outline-none focus:border-lime"
              placeholder={t.yourName}
              aria-label={t.editName}
            />
            <button
              type="button"
              onClick={commitName}
              className="tap-target flex items-center justify-center rounded-xl bg-lime px-2 text-navy-900"
              aria-label={t.saveName}
            >
              <Check size={18} strokeWidth={3} />
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              className="tap-target flex items-center justify-center rounded-xl bg-white/10 px-2 text-white"
              aria-label={t.cancel}
            >
              <X size={18} strokeWidth={3} />
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">
              {t.welcomeBack()}
              {isPlaceholderName ? (
                <button
                  type="button"
                  onClick={openNameEditor}
                  className="text-lime underline decoration-dashed decoration-1 underline-offset-4 hover:decoration-solid"
                >
                  {t.yourName}
                </button>
              ) : (
                <span className="text-lime">{learnerName}</span>
              )}
              {t.welcomeBackAfterName}{' '}
              <Rocket className="inline h-5 w-5 -translate-y-0.5" aria-hidden="true" />
            </h1>
            <button
              type="button"
              onClick={openNameEditor}
              className="tap-target -me-1 -mt-1 flex flex-none items-center gap-1 rounded-xl px-1.5 text-xs font-semibold text-white/70 hover:text-lime"
              aria-label={t.editName}
            >
              <Pencil size={15} aria-hidden="true" />
              {t.edit}
            </button>
          </div>
        )}

        {/* Dynamic slogan line — lime chip like the site's category pills */}
        {showWeekLine && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-lime-300 px-3 py-1.5 text-sm font-semibold text-navy-900">
            <Flame size={15} aria-hidden="true" />
            <span>{t.weekSlogan(week, slogan)}</span>
          </div>
        )}

        {/* Program row — opens the program picker */}
        <div className="mt-3 flex items-center gap-2 text-sm text-white/85">
          <GraduationCap size={16} className="flex-none" aria-hidden="true" />
          <button
            type="button"
            onClick={onChangeProgram}
            className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-md text-start hover:text-lime"
          >
            {programName && familyName ? (
              /*
                The family rides above the track as an eyebrow rather than
                beside it: "Content Creation · Creative Tech" wrapped onto two
                ragged lines at 390px, so the family used to be dropped.
              */
              <span className="flex flex-col py-1 leading-tight">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 group-hover:text-lime">
                  {familyName}
                </span>
                <span className="font-semibold text-white group-hover:text-lime">{programName}</span>
              </span>
            ) : programName ? (
              <span className="font-semibold text-white group-hover:text-lime">{programName}</span>
            ) : (
              <span className="font-semibold text-lime">{t.chooseProgram}</span>
            )}
            {programName && (
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold opacity-70 group-hover:opacity-100">
                <Pencil size={13} aria-hidden="true" />
                {t.change}
              </span>
            )}
          </button>
        </div>

        {/* Start date row */}
        <div className="flex items-center gap-2 text-sm text-white/85">
          <CalendarDays size={16} className="flex-none" aria-hidden="true" />
          {editingDate ? (
            <div className="flex flex-1 items-center gap-2">
              <input
                type="date"
                value={dateDraft}
                max="2100-12-31"
                onChange={(e) => setDateDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitDate()
                  if (e.key === 'Escape') setEditingDate(false)
                }}
                className="flex-1 rounded-xl border border-white/25 bg-white/10 px-2 py-1.5 text-white outline-none focus:border-lime [color-scheme:dark]"
                aria-label={t.editStartDate}
              />
              <button
                type="button"
                onClick={commitDate}
                className="tap-target flex items-center justify-center rounded-xl bg-lime px-2 text-navy-900"
                aria-label={t.saveStartDate}
              >
                <Check size={16} strokeWidth={3} />
              </button>
              <button
                type="button"
                onClick={() => setEditingDate(false)}
                className="tap-target flex items-center justify-center rounded-xl bg-white/10 px-2 text-white"
                aria-label={t.cancel}
              >
                <X size={16} strokeWidth={3} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openDateEditor}
              className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-md hover:text-lime"
            >
              <span>{startDate ? t.started(formatHuman(startDate, t.locale)) : t.setStartDate}</span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold opacity-70 group-hover:opacity-100">
                <Pencil size={13} aria-hidden="true" />
                {t.edit}
              </span>
              {!startDate && (
                <span className="ms-1 text-white/60">{t.todayHint(formatHuman(todayIso, t.locale))}</span>
              )}
            </button>
          )}
        </div>

        {/* Auto-calculated target finish date */}
        {finishDate && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-lime">
            <CalendarCheck size={13} aria-hidden="true" />
            {t.targetFinish(formatHumanDate(finishDate, t.locale))}
          </div>
        )}

        {/* Duotone learner mosaic, straight from the ALX hero */}
        <div className="mt-4 flex gap-1.5" aria-hidden="true">
          {PORTRAITS.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              loading="lazy"
              className={`h-12 w-12 flex-none rounded-xl object-cover ${i > 2 ? 'hidden sm:block' : ''}`}
            />
          ))}
          <div className="hidden flex-1 items-center justify-end pe-1 sm:flex">
            <span className="text-[11px] font-medium uppercase tracking-widest text-white/50">
              {t.doHardThings}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

function formatHuman(iso, locale) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  if (!m) return iso
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
}
