const { hashPassword, verifyPassword } = require('../src/modules/auth/auth.service');

(async () => {
  try {
    const hash = await hashPassword('correct-password');

    const correctResult = await verifyPassword('correct-password', hash);
    const wrongResult = await verifyPassword('wrong-password', hash);

    console.log('verify with correct password:', correctResult); // expect true
    console.log('verify with wrong password:', wrongResult); // expect false

    if (correctResult === true && wrongResult === false) {
      console.log('PASS');
      process.exit(0);
    } else {
      console.log('FAIL');
      process.exit(1);
    }
  } catch (err) {
    console.error('Test errored:', err.message);
    process.exit(1);
  }
})();