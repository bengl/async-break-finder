const http = require('http')
const { AsyncResource: { bind } } = require('async_hooks')

const q = []

const int = setInterval(() => {
  while (q.length) {
    q.pop()()
  }
}, 100)

function later(f) {
  q.unshift(bind(f))
}

const server = http.createServer((req, res) => {
  later(() => {
    res.end()
  })
}).listen(0, () => {
  const port = server.address().port
  http.get(`http://localhost:${port}`, (res) => {
    res.on('end', () => {
      server.close()
      clearInterval(int)
    })
    res.resume()
  })
})
