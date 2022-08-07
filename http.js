const dc = require('diagnostics_channel')
const abf = require('./async-break-finder')

const start = dc.channel('http.server.request.start')
const end = dc.channel('http.server.response.finish')

const reqMap = new WeakMap()

start.subscribe(({ request }) => {
  reqMap.set(request, abf())
})

end.subscribe(({ request }) => {
  const startAbf = reqMap.get(request)
  abf(startAbf)
})

exports.getStartForRequest = (request) => {
  return reqMap.get(request)
}
