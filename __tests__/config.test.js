"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// eslint-disable-next-line filenames/match-regex
const globals_1 = require("@jest/globals");
const config_1 = __importDefault(require("../src/config"));
(0, globals_1.test)('initialize Config and check options', () => {
    const config = new config_1.default('.github/need-info.yml');
    (0, globals_1.expect)(config.labelToAdd).toEqual('need more info');
});
