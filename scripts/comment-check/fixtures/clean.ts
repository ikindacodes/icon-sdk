#!/usr/bin/env node
const url = 'https://example.com'
const pattern = /https?:\/\//
const quotient = 1 / 2
const text = `a${quotient}b`
export const value = url + pattern.source + String(quotient) + text
