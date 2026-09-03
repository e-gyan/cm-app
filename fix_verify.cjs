const fs = require('fs');
let file = fs.readFileSync('services/storageService.ts', 'utf8');

const replacement = `
import { verifyPasscode as verifyHash, hashPasscode as createHash } from "./securityService";

export const verifyPasscode = async (name: string, passcode: string, isFast: boolean = false) => {
  try {
    const data = await loadData();
    const cleanName = name.trim().toLowerCase();
    
    // Find member by name first
    const member = data.members.find(
      (m) => m.name.trim().toLowerCase() === cleanName
    );
    
    if (member && member.passcode) {
      let isValid = false;
      // Handle the case where the Demo Admin has unhashed 0000 passcode
      if (member.passcode === passcode) {
        isValid = true;
      } else {
        isValid = await verifyHash(passcode, member.passcode);
      }
      
      if (isValid) {
        return { success: true, member, message: "" };
      }
    }
    return { success: false, message: "Invalid credentials.", member: null as any };
  } catch (e) {
    return { success: false, message: "Error verifying credentials.", member: null as any };
  }
};

export const hashPasscode = async (passcode: string) => {
  return await createHash(passcode);
};
`;

file = file.replace(/\/\/ Temporary polyfills for passcode auth[\s\S]*?export const hashPasscode = async \(passcode: string\) => passcode;/m, replacement);

fs.writeFileSync('services/storageService.ts', file);
