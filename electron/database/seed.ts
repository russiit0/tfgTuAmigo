import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const PerfilSchema = new mongoose.Schema({
  situacion: String,
  nivel_riesgo: String,
  accion_sugerida: String,
  provincia: String,
  centro_educativo: String,
  tipo_situacion: String,
});

const MetricasSchema = new mongoose.Schema({
  tristeza: Number,
  ansiedad: Number,
  alivio: Number,
  esperanza: Number,
});

const UsuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  correo: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  salt: { type: String, required: true },
  rol: { type: String, enum: ['usuario', 'admin'], default: 'usuario' },
  perfil: PerfilSchema,
  metricas: MetricasSchema,
});

const SesionSchema = new mongoose.Schema({
  id_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  date_creation: { type: Date, default: Date.now },
  date_last_save: { type: Date, default: Date.now },
  conversaciones: [new mongoose.Schema({ mensajes: [new mongoose.Schema({
    texto: { type: String, required: true },
    emisor: { type: String, required: true, enum: ['usuario', 'modelo'] },
    fecha_envio: { type: Date, default: Date.now }
  })] })]
});

const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', UsuarioSchema);
const Sesion = mongoose.models.Sesion || mongoose.model('Sesion', SesionSchema);

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
    perfil: { situacion: '', nivel_riesgo: 'bajo', accion_sugerida: '' },
    metricas: { tristeza: 0, ansiedad: 0, alivio: 0, esperanza: 0 }
  });
  await user.save();
  const sesion = new Sesion({ id_usuario: user._id, conversaciones: [] });
  await sesion.save();
  console.log(`  ✅ ${rol === 'admin' ? 'Admin' : 'Usuario'} "${correo}" creado correctamente`);
}

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuamigo';
  console.log('\n🌱 TuAmigo — Inicializando base de datos');
  console.log(`   URI: ${uri}\n`);

  await mongoose.connect(uri);
  console.log('📦 Conectado a MongoDB\n');

  console.log('👤 Creando usuarios...');

  // Admin — credenciales desde .env o valores por defecto
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@tuamigo.app';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin1234!';
  await createUser('Administrador', adminEmail, adminPassword, 'admin');

  // Usuario de prueba
  const userEmail = process.env.SEED_USER_EMAIL || 'usuario@tuamigo.app';
  const userPassword = process.env.SEED_USER_PASSWORD || 'Usuario1234!';
  await createUser('Usuario Demo', userEmail, userPassword, 'usuario');

  console.log('\n🎉 Seed completado\n');
  console.log('   Credenciales de acceso:');
  console.log(`   Admin    → ${adminEmail} / ${adminPassword}`);
  console.log(`   Usuario  → ${userEmail} / ${userPassword}`);
  console.log('\n   ⚠️  Cambia estas contraseñas en producción (.env)\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
