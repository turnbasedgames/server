const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

async function deleteAllUsers() {
  const { users } = await admin.auth().listUsers();
  await Promise.all(users.map((user) => admin.auth().deleteUser(user.uid)));
}

module.exports = {
  deleteAllUsers,
};
