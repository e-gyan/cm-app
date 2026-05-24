// Input Sanitization to prevent XSS and Injection attacks
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove JS protocol identifiers
    .replace(/on\w+=/gi, '') // Remove inline event handlers
    .trim();
};

// SHA-256 Hashing for Passcodes (Legacy support)
export const hashString = async (message: string): Promise<string> => {
    if (!message) return '';
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

// PBKDF2 Hashing (Modern secure standard)
export const hashPasscode = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
        "raw", 
        encoder.encode(password), 
        { name: "PBKDF2" }, 
        false, 
        ["deriveBits", "deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    // Export key as hex
    const exportedKey = await crypto.subtle.exportKey("raw", key);
    const keyHex = Array.from(new Uint8Array(exportedKey)).map(b => b.toString(16).padStart(2, '0')).join('');
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

    return `${saltHex}:${keyHex}`;
};

export const verifyPasscode = async (password: string, storedHash: string): Promise<boolean> => {
    // Legacy support for SHA-256 hashes without a salt
    if (!storedHash.includes(':')) {
        const legacyHash = await hashString(password);
        return legacyHash === storedHash;
    }

    const [saltHex, keyHex] = storedHash.split(':');
    if (!saltHex || !keyHex) return false;

    const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    const exportedKey = await crypto.subtle.exportKey("raw", key);
    const derivedKeyHex = Array.from(new Uint8Array(exportedKey)).map(b => b.toString(16).padStart(2, '0')).join('');

    return keyHex === derivedKeyHex;
};

// Strict Schema Validation for Imported Data
export const isValidSchema = (data: any): boolean => {
    if (!data || typeof data !== 'object') return false;
    
    // Validate Arrays exist
    if (!Array.isArray(data.members) || !Array.isArray(data.attendance)) return false;
    
    // Deep check basic member structure to ensure it matches expected Type
    if (data.members.length > 0) {
        const m = data.members[0];
        const hasValidKeys = 'id' in m && 'name' in m && 'type' in m && 'assignedChurch' in m;
        if (!hasValidKeys) return false;
        
        // Ensure critical fields are strings
        if (typeof m.id !== 'string' || typeof m.name !== 'string') return false;
    }

    return true;
};