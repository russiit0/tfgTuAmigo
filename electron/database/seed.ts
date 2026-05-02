import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { Usuario, Sesion } from './models';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function createUser(nombre: string, correo: string, password: string, rol: 'admin' | 'usuario') {
  const existing = await Usuario.findOne({ correo });
  if (existing) {
    console.log(`  ⏭  ${rol === 'admin' ? 'Admin' : 'Usuario'} "${correo}" ya existe — se omite`);
    return;
  }
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);
  const user = new Usuario({
    nombre, correo, password_hash, salt, rol,
    perfil: { situacion: '', nivel_riesgo: 'Bajo', accion_sugerida: '' },
    metricas: { tristeza: 0, ansiedad: 0, alivio: 0, esperanza: 0 }
  });
  await user.save();
  const sesion = new Sesion({ id_usuario: user._id, conversaciones: [] });
  await sesion.save();
  console.log(`  ✅ ${rol === 'admin' ? 'Admin' : 'Usuario'} "${correo}" creado`);
}

async function seed() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const userEmail = process.env.SEED_USER_EMAIL;
  const userPassword = process.env.SEED_USER_PASSWORD;

  if (!adminEmail || !adminPassword || !userEmail || !userPassword) {
    console.error('❌ Define SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_USER_EMAIL y SEED_USER_PASSWORD en .env');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuamigo';
  console.log('\n🌱 TuAmigo — Inicializando base de datos');

  await mongoose.connect(uri);
  console.log('📦 Conectado a MongoDB\n');
  console.log('👤 Creando usuarios...');

  await createUser('Administrador', adminEmail, adminPassword, 'admin');
  await createUser('Usuario Demo', userEmail, userPassword, 'usuario');

  console.log(`\n🎉 Seed completado`);
  console.log(`   Admin    → ${adminEmail}`);
  console.log(`   Usuario  → ${userEmail}`);
  console.log('\n   ⚠️  Cambia las contraseñas en producción (.env)\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
