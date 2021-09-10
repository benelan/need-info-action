// eslint-disable-next-line filenames/match-regex
import {expect, test} from '@jest/globals'
import Config from '../src/config'
import fs from 'fs'

test('initialize Config and check options', () => {
  const config = new Config(fs.readFileSync('.github/need-info.yml', 'utf8'))
  expect(config.labelToAdd).toEqual('need more info')
})
