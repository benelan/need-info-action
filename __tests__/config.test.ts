// eslint-disable-next-line filenames/match-regex
import {expect, test} from '@jest/globals'
import Config from '../src/config'
import fs from 'fs'

test('Config: initialize', () => {
  const config = new Config(fs.readFileSync('.github/need-info.yml', 'utf8'))
  expect(config.labelToAdd).toEqual('need more info')
  expect(config.labelsToCheck).toBeInstanceOf(Array)

  expect(config.requiredItems).toHaveLength(2)
  expect(config.requiredItems[0]).toHaveProperty('content')
})

test('Config: missing requiredItem property', () => {
  const file = fs.readFileSync('__tests__/error.config.yml', 'utf8')
  expect(() => new Config(file)).toThrowError(
    // eslint-disable-next-line i18n-text/no-en
    'Invalid configuration, ending action'
  )
})
