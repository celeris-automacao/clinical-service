// generate-token.js
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

// Carrega as variáveis do arquivo .env
dotenv.config({ path: path.resolve(__dirname, '.env') });

const secret = process.env.SUPABASE_JWT_SECRET;

if (!secret) {
  console.error("❌ ERRO: SUPABASE_JWT_SECRET não encontrada no arquivo .env");
  process.exit(1);
}

const payload = {
  sub: "f47ac10b-58cc-4372-a567-0e02b2c3d479", // ID do Paciente do seu SQL
  email: "paciente@teste.com",
  user_metadata: {
    tenant_id: "519da169-5c88-4984-aaf1-935c3b1ea416", // ID da Clínica
    role: "doctor" // Role do seu schema access : doctot ou patient
  }
};

const token = jwt.sign(payload, secret, { expiresIn: '1d' });

console.log("\n✅ Token Gerado com Segurança (Lido do .env):");
console.log("--------------------------------------------");
console.log(token);
console.log("--------------------------------------------\n");