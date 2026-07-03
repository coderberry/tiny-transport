import { describe, expect, it } from 'vitest'
import { hash2, mulberry32, pick, randInt } from './rng'

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(1234)
    const b = mulberry32(1234)
    for (let i = 0; i < 100; i++) expect(a()).toBe(b())
  })

  it('differs across seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('stays in [0, 1)', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('hash2', () => {
  it('is stable and seed-sensitive', () => {
    expect(hash2(7, 10, 20)).toBe(hash2(7, 10, 20))
    expect(hash2(7, 10, 20)).not.toBe(hash2(8, 10, 20))
    expect(hash2(7, 10, 20)).not.toBe(hash2(7, 11, 20))
  })
})

describe('helpers', () => {
  it('randInt covers the inclusive range', () => {
    const rng = mulberry32(5)
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) seen.add(randInt(rng, 1, 3))
    expect([...seen].sort()).toEqual([1, 2, 3])
  })

  it('pick returns elements from the array', () => {
    const rng = mulberry32(6)
    for (let i = 0; i < 50; i++) {
      expect(['a', 'b', 'c']).toContain(pick(rng, ['a', 'b', 'c']))
    }
  })
})
