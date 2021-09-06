import {expect, test} from '@jest/globals'
import Config from '../src/config'


test('initialize Config and check options', () => {
  const config = new Config('.github/need-info-config.yml')
  expect(config.labelToAdd).toEqual('need more info')
})