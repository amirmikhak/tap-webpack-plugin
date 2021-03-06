var tapOut = require('tap-out')
var spawn = require('child_process').spawn
var map = require('lodash/map')
var filter = require('lodash/filter')
var forEach = require('lodash/forEach')

function TapWebpackPlugin () {
}

TapWebpackPlugin.prototype.apply = function (compiler) {
  compiler.plugin('after-emit', emitted)

  function emitted (compilation, callback) {
    var entry = filter(compilation.chunks, 'entry')
    var files = map(entry, function (c) { return c.files[0] })
    var assets = map(files, function (f) { return compilation.assets[f] })
    var source = map(assets, function (a) { return a.source() }).join('\n')

    var isExited = false
    var isParsed = false

    var parser = tapOut(parsed)
    var proc = spawn(process.execPath, { stdio: ['pipe', 'pipe', 'inherit'] })

    proc.stdout.pipe(parser)
    proc.stdin.end(source, 'utf8')
    proc.on('exit', exited)

    function parsed (err, results) {
      if (err) {
        compilation.errors.push(
            new Error('could not parse TAP output'))
      } else if (results.fail.length > 0) {
        forEach(results.fail, function (f) {
          var test = results.tests[f.test - 1]
          var message = getMessage(test, f)
          compilation.errors.push(new Error(message))
        })
      }

      isParsed = true
      return done()
    }

    function exited (code) {
      if (code !== 0) {
        compilation.errors.push(new Error('tests failed'))
      }

      isExited = true
      return done()
    }

    function done () {
      if (isExited && isParsed) {
        return callback()
      }
    }
  }
}

function getMessage (test, fail) {
  var name = test ? test.name + ' - ' + fail.name : fail.name
  var message = 'failed test: ' + name

  var error = fail.error
  if (error && error.expected && error.actual) {
    message += '\n  Expected: ' + error.expected +
      '\n  Actual: ' + error.actual
  }

  return message
}

module.exports = TapWebpackPlugin
