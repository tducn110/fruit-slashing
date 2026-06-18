import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const expectedProject = "fruit-games-79f91";
if (process.argv[2] !== expectedProject || process.argv[3] !== "--confirm-delete") {
  console.error(`Usage: npm run reset:leaderboard -- ${expectedProject} --confirm-delete`);
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: expectedProject });
const db = getFirestore();

async function deleteCollection(name) {
  let deleted = 0;
  while (true) {
    const snapshot = await db.collection(name).limit(400).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    deleted += snapshot.size;
  }
  console.log(`${name}: deleted ${deleted}`);
}

await deleteCollection("runs");

const users = await db.collection("users").get();
for (let index = 0; index < users.docs.length; index += 400) {
  const batch = db.batch();
  users.docs.slice(index, index + 400).forEach((document) => {
    batch.set(document.ref, { bestScore: 0, totalGamesPlayed: 0, updatedAt: Date.now() }, { merge: true });
  });
  await batch.commit();
}
console.log(`users: reset ${users.size}`);
