// Firebase Information

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

console.log('getFirestore:', getFirestore); 

const firebaseConfig = {
  apiKey: "AIzaSyD5roiNMppNzr98MlwHtO4nOqDTv0IafBw",
  authDomain: "foodclock-a1054.firebaseapp.com",
  projectId: "foodclock-a1054",
  storageBucket: "foodclock-a1054.appspot.com",
  messagingSenderId: "561531884108",
  appId: "1:561531884108:web:8490b5af0a7454c86a5ae9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default db;
