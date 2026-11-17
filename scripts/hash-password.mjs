// Gebruik: npm run hash-password -- "JouwSterkeWachtwoord"
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const pw = process.argv[2];
if (!pw || pw.length < 10) {
  console.error('Geef een wachtwoord van minimaal 10 tekens: npm run hash-password -- "JouwWachtwoord"');
  process.exit(1);
}
const hash = bcrypt.hashSync(pw, 12);
console.log('\nADMIN_PASSWORD_HASH=b64:' + Buffer.from(hash).toString('base64'));
console.log('SESSION_SECRET=' + crypto.randomBytes(32).toString('base64url') + '\n');
console.log('Zet beide waarden als Environment Variables in Vercel. Het wachtwoord zelf wordt nergens opgeslagen.');
