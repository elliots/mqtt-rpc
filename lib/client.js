'use strict';
/*
 * mqtt-rpc
 * https://github.com/wolfeidau/mqtt-rpc
 *
 * Copyright (c) 2013 Mark Wolfe
 * Licensed under the MIT license.
 */
var crypto = require('crypto');
var mqtt = require('mqtt');
var mqttrouter = require('mqtt-router');
var codecs = require('./codecs.js');
var debug = require('debug')('mqtt-rpc:client');

var Client = function (mqttclient) {

  // default to JSON codec
  this.codec = codecs.byName('json');

  this.mqttclient = mqttclient || mqtt.createClient();

  this.router = mqttrouter.wrap(mqttclient);

  this.inFlight = {};

  var self = this;

  this._generator = function () {
    return crypto.randomBytes(5).readUInt32BE(0).toString(16);
  };

  this._handleResponse = function(topic, message) {

    var msg = self.codec.decode(message);
    var id = msg._correlationId;

    debug('handleResponse', topic, id, 'message', message);

    debug('inflight', self.inFlight[id]);

    if (id && self.inFlight[id]) {
      self.inFlight[id].cb(msg.err, msg.data);
      delete self.inFlight[id];
    }

  };

  this._sendMessage = function(topic, message, cb) {

    if (cb) {
      var id = self._generator();
      self.inFlight[id] = {cb: cb};
      message._correlationId = id;
    }

    debug('sendMessage', topic, message);

    self.mqttclient.publish(topic, self.codec.encode(message));
  };

  this.publish = function(topic, args, cb) {

    if (cb) {
      var replyTopic = topic + '/reply';

      self.router
        .subscribe(replyTopic, self._handleResponse);

      debug('callRemote', 'subscribe', replyTopic);
    }

    self._sendMessage(topic, args, cb);
  };

  this.callRemote = function(prefix, name, args, cb){
    var requestTopic = prefix + '/' + name;
    self.publish(requestTopic, args, cb);
  };

  this.format = function(format){
    this.codec = codecs.byName(format);
  };

};

module.exports = Client;
