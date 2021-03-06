/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const parallel = require('async/parallel')
const TCP = require('libp2p-tcp')
const pull = require('pull-stream')
const PeerBook = require('peer-book')

const utils = require('./utils')
const Swarm = require('../src')

describe('high level API - 1st without stream multiplexing (on TCP)', () => {
  let swarmA
  let peerA
  let swarmB
  let peerB

  before((done) => {
    utils.createInfos(2, (err, infos) => {
      if (err) {
        return done(err)
      }

      peerA = infos[0]
      peerB = infos[1]

      peerA.multiaddrs.add('/ip4/127.0.0.1/tcp/9001')
      peerB.multiaddrs.add('/ip4/127.0.0.1/tcp/9002/ipfs/QmcgpsyWgH8Y8ajJz1Cu72KnS5uo2Aa2LpzU7kinSupNKC')

      swarmA = new Swarm(peerA, new PeerBook())
      swarmB = new Swarm(peerB, new PeerBook())

      swarmA.transport.add('tcp', new TCP())
      swarmB.transport.add('tcp', new TCP())

      parallel([
        (cb) => swarmA.transport.listen('tcp', {}, null, cb),
        (cb) => swarmB.transport.listen('tcp', {}, null, cb)
      ], done)
    })
  })

  after((done) => {
    parallel([
      (cb) => swarmA.close(cb),
      (cb) => swarmB.close(cb)
    ], done)
  })

  it('handle a protocol', (done) => {
    swarmB.handle('/bananas/1.0.0', (protocol, conn) => pull(conn, conn))
    expect(Object.keys(swarmB.protocols).length).to.equal(2)
    done()
  })

  it('dial on protocol', (done) => {
    swarmB.handle('/pineapple/1.0.0', (protocol, conn) => pull(conn, conn))

    swarmA.dial(peerB, '/pineapple/1.0.0', (err, conn) => {
      expect(err).to.not.exist()
      pull(
        pull.empty(),
        conn,
        pull.onEnd(done)
      )
    })
  })

  it('dial on protocol (returned conn)', (done) => {
    swarmB.handle('/apples/1.0.0', (protocol, conn) => pull(conn, conn))

    const conn = swarmA.dial(peerB, '/apples/1.0.0', (err) => {
      expect(err).to.not.exist()
    })

    pull(
      pull.empty(),
      conn,
      pull.onEnd(done)
    )
  })

  it('dial to warm a conn', (done) => {
    swarmA.dial(peerB, done)
  })

  it('dial on protocol, reuse warmed conn', (done) => {
    swarmA.dial(peerB, '/bananas/1.0.0', (err, conn) => {
      expect(err).to.not.exist()
      pull(
        pull.empty(),
        conn,
        pull.onEnd(done)
      )
    })
  })

  it('unhandle', () => {
    const proto = '/bananas/1.0.0'
    swarmA.unhandle(proto)
    expect(swarmA.protocols[proto]).to.not.exist()
  })
})
