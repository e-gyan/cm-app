// Input Sanitization to prevent XSS and Injection attacks
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove JS protocol identifiers
    .replace(/on\w+=/gi, '') // Remove inline event handlers
    .trim();
};

// SHA-256 Hashing for Passcodes
export const hashString = async (message: string): Promise<string> => {
    if (!message) return '';
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
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