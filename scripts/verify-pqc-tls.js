#!/usr/bin/env node
/**
 * Deployment Verification Utility: Post-Quantum TLS Key Exchange Probe
 * Checks the negotiated TLS version, cipher suite, and ephemeral key-exchange group
 * on the public endpoint to verify standardized hybrid ML-KEM (FIPS 203) support.
 *
 * Usage:
 *   node scripts/verify-pqc-tls.js [hostname] [port]
 *   npm run verify:pqc
 */

'use strict';

const tls = require('tls');

// Target hostname: command-line arg, or environment variable, or production Vercel default
const targetHost = process.argv[2] || process.env.DEPLOYED_DOMAIN || 'telangana-yogasan-portal.vercel.app';
const targetPort = parseInt(process.argv[3], 10) || 443;

console.log('==============================================================================');
console.log('Post-Quantum Cryptography (PQC) TLS Key Exchange Verification');
console.log(`Target: https://${targetHost}:${targetPort}`);
console.log('Standard: NIST FIPS 203 (ML-KEM / X25519MLKEM768)');
console.log('==============================================================================\n');

const options = {
  host: targetHost,
  port: targetPort,
  servername: targetHost,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2'
};

const startTime = Date.now();

const socket = tls.connect(options, () => {
  const durationMs = Date.now() - startTime;
  const protocol = socket.getProtocol();
  const cipher = socket.getCipher();
  const ephemInfo = typeof socket.getEphemeralKeyInfo === 'function' ? socket.getEphemeralKeyInfo() : null;
  const cert = socket.getPeerCertificate();

  console.log('==> Connection Established:');
  console.log(`    - Remote Address:       ${socket.remoteAddress || 'Unknown'}`);
  console.log(`    - TLS Protocol:         ${protocol || 'Unknown'}`);
  console.log(`    - Cipher Suite:         ${cipher ? cipher.name : 'Unknown'}`);
  console.log(`    - Peer Certificate CN:  ${cert && cert.subject ? cert.subject.CN : 'Unknown'}`);
  console.log(`    - Certificate Issuer:   ${cert && cert.issuer ? cert.issuer.O || cert.issuer.CN : 'Unknown'}`);
  console.log(`    - Handshake Duration:   ${durationMs} ms\n`);

  console.log('==> Key Exchange Analysis:');
  const groupName = ephemInfo && ephemInfo.name ? ephemInfo.name : null;
  const groupType = ephemInfo && ephemInfo.type ? ephemInfo.type : 'N/A';

  console.log(`    - Key Exchange Type:    ${groupType}`);
  console.log(`    - Negotiated Group:     ${groupName || 'Classical / Unspecified'}`);

  const isPostQuantum = groupName && /ml-?kem|kyber/i.test(groupName);

  if (isPostQuantum) {
    console.log('\n[PASS] Post-Quantum Protection ACTIVE:');
    console.log(`       The endpoint negotiated standardized hybrid key exchange: ${groupName}`);
    console.log('       Network traffic is protected against Harvest Now, Decrypt Later (HNDL) attacks.');
  } else {
    console.log('\n[INFO] Classical Key Exchange Negotiated:');
    console.log(`       Negotiated group: ${groupName || (cipher ? cipher.name : 'Unknown')}`);
    console.log('       Note: Hybrid ML-KEM requires both the server/edge and the connecting client');
    console.log('       runtime (e.g. Chrome 131+, Firefox 132+, Node.js 24+/OpenSSL 3.5+) to advertise');
    console.log('       X25519MLKEM768 support in the TLS 1.3 ClientHello supported_groups extension.');
  }

  socket.end();
  process.exit(0);
});

socket.setTimeout(10000, () => {
  console.error('\n[ERROR] Connection timed out after 10 seconds.');
  socket.destroy();
  process.exit(1);
});

socket.on('error', (err) => {
  console.error(`\n[ERROR] TLS Handshake failed: ${err.message}`);
  process.exit(1);
});
