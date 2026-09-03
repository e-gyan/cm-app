const fs = require('fs');
let file;

// Fix App.tsx missing imports
file = fs.readFileSync('App.tsx', 'utf8');
file = file.replace(/import { subscribeToData, loadData } from "\.\/services\/storageService";/, 'import { subscribeToData, loadData, markNotificationRead, clearNotifications } from "./services/storageService";');
file = file.replace(/syncFromCloud\(\)/g, 'Promise.resolve()');
fs.writeFileSync('App.tsx', file);

// AttendanceTaker.tsx
file = fs.readFileSync('components/AttendanceTaker.tsx', 'utf8');
file = file.replace(/syncToCloud\(\)/g, 'Promise.resolve()');
// replace data.members which is causing the promise error (since the prop type might have been polluted)
file = file.replace(/data\.members\.filter/g, '(data.members || []).filter');
fs.writeFileSync('components/AttendanceTaker.tsx', file);

// Finances.tsx
file = fs.readFileSync('components/Finances.tsx', 'utf8');
file = file.replace(/import { saveTransactions, addTransaction } from "\.\.\/services\/storageService";/, 'import { saveTransactions } from "../services/storageService";');
file = file.replace(/addTransaction\(newTransaction\)/g, 'saveTransactions([...data.transactions, newTransaction])');
fs.writeFileSync('components/Finances.tsx', file);

// Login.tsx
file = fs.readFileSync('components/Login.tsx', 'utf8');
file = file.replace(/data\.members\.find/g, '(data.members || []).find');
fs.writeFileSync('components/Login.tsx', file);

// Settings.tsx
file = fs.readFileSync('components/Settings.tsx', 'utf8');
file = file.replace(/syncToCloud/g, 'Promise.resolve');
fs.writeFileSync('components/Settings.tsx', file);

