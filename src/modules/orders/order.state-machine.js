const TRANSITIONS = {
  placed: ['vendor_accepted', 'cancelled'],
  vendor_accepted: ['rider_assigned', 'cancelled'],
  rider_assigned: ['picked_up', 'cancelled'],
  picked_up: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

function isValidTransition(fromStatus, toStatus) {
  const allowed = TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

module.exports = { isValidTransition, TRANSITIONS };