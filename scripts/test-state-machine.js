const { isValidTransition } = require('../src/modules/orders/order.state-machine');

const cases = [
  { from: 'placed', to: 'vendor_accepted', expect: true },
  { from: 'placed', to: 'picked_up', expect: false }, // skips states
  { from: 'vendor_accepted', to: 'rider_assigned', expect: true },
  { from: 'rider_assigned', to: 'picked_up', expect: true },
  { from: 'picked_up', to: 'delivered', expect: true },
  { from: 'placed', to: 'cancelled', expect: true },
  { from: 'delivered', to: 'cancelled', expect: false }, // no transitions out of delivered
];

let failures = 0;

for (const { from, to, expect } of cases) {
  const result = isValidTransition(from, to);
  const pass = result === expect;
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${from} -> ${to} = ${result} (expected ${expect})`);
}

process.exit(failures === 0 ? 0 : 1);