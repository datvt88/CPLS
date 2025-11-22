import { initializeApp, getApps, getApp } from 'firebase/app'
import { getDatabase, Database } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyDB3e7EIk8cZEtKsEdfZza0hSIAMmvFRQ4',
  authDomain: 'wp-realtime-chat-cpls.firebaseapp.com',
  databaseURL: 'https://wp-realtime-chat-cpls-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'wp-realtime-chat-cpls',
  storageBucket: 'wp-realtime-chat-cpls.appspot.com',
  messagingSenderId: '234321083134',
  appId: '1:234321083134:web:c3b5816f0f5627a80683af',
  measurementId: 'G-QH3C2ZYD3N',
}

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
const database: Database = getDatabase(app)

export { app, database }
