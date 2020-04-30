const DatMirror = require('./dat-mirror.js')
const fs = require('fs')
const config = JSON.parse(fs.readFileSync('./config.json'))
const x = new DatMirror(config.instructionDatKey,config.monitorDatKey)
