const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const secret = process.env.SUPABASE_JWT_SECRET;

if (!secret) {
  console.error('ERRO: SUPABASE_JWT_SECRET nao encontrada no arquivo .env');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');

if (!supabaseUrl) {
  console.error('ERRO: SUPABASE_URL nao encontrada no arquivo .env');
  process.exit(1);
}

const seededTenantId = 'c56a4180-65aa-42ec-a945-5fd21dec0538';
const seededProfiles = {
  owner: {
    sub: '11111111-1111-4111-8111-111111111111',
    email: 'owner@clinica.com',
    role: 'owner',
  },
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {};
  let profile = 'owner';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith('--') && profile === 'owner') {
      profile = arg.toLowerCase();
      continue;
    }

    if (!arg.startsWith('--')) {
      continue;
    }

    const key = arg.slice(2);
    const value = args[index + 1];

    if (!value || value.startsWith('--')) {
      options[key] = true;
      continue;
    }

    options[key] = value;
    index += 1;
  }

  return { profile, options };
}

function buildPayload(profileName, options) {
  const selectedProfile = seededProfiles[profileName];

  if (!selectedProfile) {
    console.error(`Perfil invalido: ${profileName}`);
    console.error(
      `Perfis disponiveis: ${Object.keys(seededProfiles).join(', ')}`,
    );
    process.exit(1);
  }

  const tenantId = options.tenant || seededTenantId;
  const subject = options.sub || selectedProfile.sub;
  const email = options.email || selectedProfile.email;
  const userRole = options.userRole || options.userrole || selectedProfile.role;

  return {
    sub: subject,
    email,
    user_metadata: {
      tenant_id: tenantId,
      role: userRole,
    },
    aud: 'authenticated',
    role: 'authenticated',
    iss: `${supabaseUrl}/auth/v1`,
  };
}

const { profile, options } = parseArgs(process.argv);
const expiresIn = options.expiresIn || options.expiresin || '1d';
const payload = buildPayload(profile, options);

const token = jwt.sign(payload, secret, {
  algorithm: 'HS256',
  expiresIn,
});

console.log(`\nToken gerado para o perfil: ${profile}`);
console.log('--------------------------------------------');
console.log(token);
console.log('--------------------------------------------');
console.log('\nPayload usado:');
console.log(JSON.stringify(payload, null, 2));
console.log('\nUso:');
console.log('node generate-token.js owner');
console.log(
  'node generate-token.js owner --tenant c56a4180-65aa-42ec-a945-5fd21dec0538 --expiresIn 8h',
);
