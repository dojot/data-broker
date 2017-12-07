let kafka = {
  'zookeeper': '172.17.0.2:2181',
  'producer': {
    'topic': 'all-devices',
    'partition': -1,
    'key': ''
  },
  'consumer': {
    'autoCommit' : true,
    'fetchMaxWaitMs' : 1000,
    'fetchMaxBytes' : 1048576,
    'group' : 'subscription-engine',
    'id' : 'consumer-1'
  },
  'consumerTopics': [
    { 'topic' : 'all-devices', 'partition' : -1}
  ]
};

let mqtt = {
  username: '',
  password: '',
  host: 'localhost',
  port: 1883,
  protocolId: 'MQIsdp',
  protocolVersion: 3,
  secure: false,
  tls: {
    key: 'client-key.pem',
    cert: 'client-cert.pem',
    ca: ['server-cert.pem'],
    version: 'TLSv1_2_method' // If empty, TLS version is automatic
  }
};

export {kafka};
export {mqtt};