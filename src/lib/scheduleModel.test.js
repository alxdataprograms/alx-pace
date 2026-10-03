import { describe, it, expect } from 'vitest'
import { buildScheduleFromCsv } from './scheduleModel'

// Small fixture exercising every normalization rule: a banner row, merged
// (forward-filled) Module/Week cells, a blank separator row, a quoted
// multi-line graded cell, and a duplicate lesson title in the same week.
const CSV = [
  'Self Paced Track,,,,',
  'Module,Week,Lessons,CYU,Eval',
  'DA-1: Foundations,Week 1,Intro,CYU A,',
  ',,Intro,CYU B,Graded Test: Intro Redo',
  ',Week 2,SQL Basics,,"Integrated Project: Part 1\nGraded Test: Part 1"',
  ',,,,',
  'DA-2: Reporting,Week 3,Dashboards,CYU D,Graded Exam: Final',
].join('\r\n')

describe('buildScheduleFromCsv', () => {
  const model = buildScheduleFromCsv(CSV)

  it('skips banner and blank separator rows', () => {
    expect(model.totalLessons).toBe(4)
  })

  it('groups into the right weeks and modules', () => {
    expect(model.weeks.map((w) => w.week)).toEqual([1, 2, 3])
    expect(model.modules.map((m) => m.code)).toEqual(['DA-1', 'DA-2'])
  })

  it('forward-fills merged Module and Week cells onto continuation rows', () => {
    const week2 = model.weeks.find((w) => w.week === 2)
    expect(week2.moduleCode).toBe('DA-1')
    const week1 = model.weeks.find((w) => w.week === 1)
    expect(week1.lessons).toHaveLength(2)
  })

  it('spans module week ranges correctly', () => {
    const da1 = model.modules.find((m) => m.code === 'DA-1')
    expect([da1.weekStart, da1.weekEnd]).toEqual([1, 2])
    const da2 = model.modules.find((m) => m.code === 'DA-2')
    expect([da2.weekStart, da2.weekEnd]).toEqual([3, 3])
  })

  it('gives duplicate titles in the same week distinct, stable ids', () => {
    const ids = model.lessons.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('da-1-w1-intro')
    expect(ids).toContain('da-1-w1-intro-2')
  })

  it('classifies graded cells', () => {
    const byId = Object.fromEntries(model.lessons.map((l) => [l.id, l]))
    expect(byId['da-1-w1-intro-2'].gradedType).toBe('graded-test')
    expect(byId['da-2-w3-dashboards'].gradedType).toBe('exam')
    const project = model.lessons.find((l) => l.gradedType === 'integrated-project')
    expect(project).toBeTruthy()
  })

  it('splits a multi-line graded cell into title + subtitle', () => {
    const project = model.lessons.find((l) => l.gradedType === 'integrated-project')
    expect(project.graded.title).toBe('Integrated Project: Part 1')
    expect(project.graded.subtitle).toBe('Graded Test: Part 1')
  })

  it('counts graded items consistently', () => {
    expect(model.totalGraded).toBe(model.lessons.filter((l) => l.isGraded).length)
  })
})

// Creative Tech layout: one item per row (lesson | activity | graded), a
// "½ week", a buffer week that starts mid-week, and a fractional week label.
const CREATIVE_CSV = [
  'Graphic Design Self-Paced Track,,,,',
  'Module,Week,Lessons,Activity,"Evaluation quiz\nGraded Test"',
  'GD-1: Fundamentals,Week 1,Welcome,,',
  ',,,Activity: Sketch,',
  ',,,,',
  ',,,,Quiz 1: Foundations',
  ',Week 2 (½ week),Wrap Up,,',
  ',,,,Mastery Project: Poster',
  ',Week 2.5 (Buffer),Buffer / catch-up week,,',
  'GD-2: Type,Week 3.5,Typography,,',
].join('\r\n')

describe('buildScheduleFromCsv — activity layout', () => {
  const model = buildScheduleFromCsv(CREATIVE_CSV, { layout: 'activity' })
  const byTitle = Object.fromEntries(model.lessons.map((l) => [l.title, l]))

  it('turns every non-blank row into exactly one item, except the buffer marker', () => {
    expect(model.lessons.map((l) => l.title)).toEqual([
      'Welcome',
      'Activity: Sketch',
      'Quiz 1: Foundations',
      'Wrap Up',
      'Mastery Project: Poster',
      'Typography',
    ])
  })

  it('tags each item with its kind', () => {
    expect(byTitle['Welcome'].kind).toBe('lesson')
    expect(byTitle['Activity: Sketch'].kind).toBe('activity')
    expect(byTitle['Activity: Sketch'].checkYourUnderstanding).toBeNull()
    expect(byTitle['Quiz 1: Foundations'].kind).toBe('assessment')
    expect(byTitle['Quiz 1: Foundations'].lesson).toBe('')
  })

  it('classifies quizzes and mastery projects', () => {
    expect(byTitle['Quiz 1: Foundations'].gradedType).toBe('quiz')
    expect(byTitle['Mastery Project: Poster'].gradedType).toBe('mastery-project')
    expect(model.totalGraded).toBe(2)
  })

  it('keeps buffer weeks on the timeline with nothing to tick off', () => {
    const buffer = model.weeks.find((w) => w.week === 2.5)
    expect(buffer.isBuffer).toBe(true)
    expect(buffer.lessons).toHaveLength(0)
    expect(buffer.moduleCode).toBe('GD-1')
  })

  it('flags half weeks and parses fractional week numbers', () => {
    expect(model.weeks.map((w) => w.week)).toEqual([1, 2, 2.5, 3.5])
    expect(model.weeks.find((w) => w.week === 2).isHalf).toBe(true)
  })

  it('lays weeks out on a day timeline (mid-day starts round up)', () => {
    const spans = model.weeks.map((w) => [w.week, w.startDay, w.endDay])
    expect(spans).toEqual([
      [1, 0, 7],
      [2, 7, 11], // half week: 3.5 days, its successor starts on day ceil(10.5)
      [2.5, 11, 18],
      [3.5, 18, 25],
    ])
    expect(model.totalDays).toBe(25)
  })

  it('namespaces ids by module code', () => {
    expect(byTitle['Welcome'].id).toBe('gd-1-w1-welcome')
    expect(byTitle['Typography'].id).toBe('gd-2-w3.5-typography')
  })
})

describe('buildScheduleFromCsv — program length', () => {
  it('derives totalDays / totalWeeks from the data', () => {
    const model = buildScheduleFromCsv(CSV)
    expect(model.totalDays).toBe(21)
    expect(model.totalWeeks).toBe(3)
  })
})
