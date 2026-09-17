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

// Auto-determine gender based on English and typical Christian/GCP first names and heuristics
export const determineGenderByName = (fullName: string): "MALE" | "FEMALE" => {
  if (!fullName) return "MALE";
  
  const clean = fullName.trim().toLowerCase();
  
  // Title checks
  if (clean.startsWith("mr ") || clean.startsWith("mr.") || clean.startsWith("master ") || clean.startsWith("sir ")) {
    return "MALE";
  }
  if (clean.startsWith("mrs ") || clean.startsWith("mrs.") || clean.startsWith("ms ") || clean.startsWith("ms.") || clean.startsWith("miss ") || clean.startsWith("lady ")) {
    return "FEMALE";
  }

  // Get the first word (first name)
  const parts = clean.split(/[\s,]+/);
  let firstName = parts[0] || "";
  // If first name is a title like "pastor" or "dr", look at the next part
  if ((firstName === "pastor" || firstName === "dr" || firstName === "dr." || firstName === "reverend" || firstName === "rev" || firstName === "rev.") && parts.length > 1) {
    firstName = parts[1];
  }

  // Clean punctuation from first name
  firstName = firstName.replace(/[^a-z]/g, "");

  const femaleNames = new Set([
    "mary", "maria", "margaret", "patricia", "linda", "barbara", "elizabeth", "jennifer", "susan", "dorothy", 
    "lisa", "nancy", "karen", "betty", "helen", "sandra", "donna", "carol", "ruth", "sharon", "michelle", 
    "laura", "sarah", "kimberly", "deborah", "jessica", "shirley", "cynthia", "angela", "melissa", "brenda", 
    "amy", "anna", "rebecca", "virginia", "kathleen", "pamela", "martha", "debra", "amanda", "stephanie", 
    "carolyn", "christine", "marie", "janet", "catherine", "frances", "ann", "joyce", "diane", "alice", 
    "julie", "heather", "teresa", "doris", "gloria", "evelyn", "jean", "cheryl", "mildred", "katherine", 
    "joan", "ashley", "judith", "rose", "janice", "kelly", "nicole", "judy", "christina", "kathy", 
    "theresa", "beverly", "denise", "tammy", "irene", "jane", "lori", "rachel", "marilyn", "andrea", 
    "kathryn", "louise", "sara", "anne", "jacqueline", "wanda", "bonnie", "julia", "ruby", "lois", 
    "tina", "phyllis", "norma", "paula", "diana", "annie", "lillian", "emily", "robin", "peggy", 
    "crystal", "gladys", "rita", "dawn", "connie", "florence", "tracy", "edna", "tiffany", "carmen", 
    "rosa", "cindy", "grace", "wendy", "victoria", "edith", "kim", "sherry", "sylvia", "josephine", 
    "thelma", "shannon", "sheila", "ethel", "ellen", "elaine", "marjorie", "carrie", "charlotte", 
    "monica", "esther", "pauline", "emma", "juanita", "anita", "rhonda", "hazel", "amber", "eva", 
    "debbie", "april", "leslie", "clara", "lucille", "jamie", "joanne", "eleanor", "valerie", 
    "danielle", "megan", "alicia", "suzanne", "michele", "gail", "bertha", "darlene", "veronica", 
    "jill", "erin", "geraldine", "lauren", "cathy", "joann", "lorraine", "lynn", "sally", "regina", 
    "erica", "beatrice", "dolores", "bernice", "audrey", "yvonne", "annette", "june", "samantha", 
    "marion", "dana", "stacy", "ana", "renee", "ida", "vivian", "roberta", "holly", "brittany", 
    "melanie", "loretta", "yolanda", "jeanette", "laurie", "katie", "kristen", "vanessa", "alma", 
    "sue", "elsie", "beth", "jeanne", "vicki", "carla", "rosemary", "eileen", "lucy", "gertrude", 
    "leah", "penny", "kayla", "chloe", "zoe", "sophie", "sophia", "olivia", "ava", "isabella", 
    "mia", "abigail", "amelia", "harriet", "cecilia", "bridget", "agnes", "hilda", "matilda",
    "stella", "bella", "ella", "lily", "daisy", "violet", "jasmine", "rose", "iris", "ruby", "pearl",
    "ama", "abena", "akua", "yaaa", "afua", "afia", "amina", "aisha", "fatima"
  ]);

  const maleNames = new Set([
    "james", "john", "robert", "michael", "william", "david", "richard", "charles", "joseph", "thomas", 
    "christopher", "daniel", "paul", "mark", "donald", "george", "kenneth", "steven", "edward", "brian", 
    "ronald", "anthony", "kevin", "jason", "matthew", "gary", "timothy", "jose", "larry", "jeffrey", 
    "frank", "sheldon", "isaac", "abraham", "kelvin", "gerald", "raymond", "gregory", "bruce", "marcus", 
    "denis", "derrick", "dennis", "emmanuel", "samuel", "joshua", "caleb", "benjamin", "jonathan", 
    "simon", "peter", "andrew", "luke", "stephen", "philip", "aaron", "moses", "elijah", "elisha", 
    "gideon", "samson", "solomon", "josiah", "hezekiah", "ezra", "nehemiah", "job", "isaiah", 
    "jeremiah", "ezekiel", "hosea", "joel", "amos", "obadiah", "jonah", "micah", "nahum", 
    "habakkuk", "zephaniah", "haggai", "zechariah", "malachi", "alexander", "henry", "arthur", 
    "alfred", "louis", "frederick", "albert", "christian", "oliver", "jack", "harry", "charlie", 
    "alfie", "archie", "leo", "oscar", "noah", "muhammad", "brandon", "justin", "tyler", "zachary", 
    "nathan", "austin", "dylan", "jordan", "ethan", "connor", "logan", "nicholas", "gabriel", 
    "colin", "cameron", "kyle", "ryan", "jacob", "liam", "mason", "lucas", "aiden", "walter",
    "patrick", "harold", "douglas", "roger", "albert", "arthur", "terry", "gerald", "keith",
    "ralph", "roy", "eugene", "louis", "billy", "bobby", "steve", "tim", "ricky", "jeff", "justin",
    "ben", "dan", "sam", "rob", "will", "fred", "harry", "joe", "tom", "mike", "dave", "chris", "alex",
    "kwaku", "kojo", "kwabena", "yaw", "kofi", "kwame", "kwesi", "kweku", "abdul"
  ]);

  if (femaleNames.has(firstName)) return "FEMALE";
  if (maleNames.has(firstName)) return "MALE";

  // Suffix/pattern heuristics
  if (firstName.endsWith("a") || 
      firstName.endsWith("bel") || 
      firstName.endsWith("belle") || 
      firstName.endsWith("tina") || 
      firstName.endsWith("ette") || 
      firstName.endsWith("ice") || 
      firstName.endsWith("ine") || 
      firstName.endsWith("ia") || 
      firstName.endsWith("ie") || 
      firstName.endsWith("na") || 
      firstName.endsWith("ra") || 
      firstName.endsWith("da")) {
    return "FEMALE";
  }

  if (firstName.endsWith("son") || 
      firstName.endsWith("ard") || 
      firstName.endsWith("bert") || 
      firstName.endsWith("ald") || 
      firstName.endsWith("old") || 
      firstName.endsWith("rick") || 
      firstName.endsWith("ton") || 
      firstName.endsWith("vin")) {
    return "MALE";
  }

  // Default fallback
  return "MALE";
};