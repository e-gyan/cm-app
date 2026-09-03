const fs = require('fs');
let file = fs.readFileSync('components/MembersList.tsx', 'utf8');

const target = `                          <button
                            onClick={() => archiveMember(member)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Archive"
                                >
                                  <Archive size={16} />
                                </button>`;
const replacement = `                          <button onClick={() => setMemberToArchive(member)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Archive">
                                  <Archive size={16} />
                                </button>`;
file = file.replace(target, replacement);
fs.writeFileSync('components/MembersList.tsx', file);
