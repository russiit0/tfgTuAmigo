import mongoose from 'mongoose';

const PerfilSchema = new mongoose.Schema({
  situacion: String,
  nivel_riesgo: String,
  accion_sugerida: String,
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
  rol: { type: String, enum: ['normal-user', 'admin'], default: 'normal-user' },
  perfil: PerfilSchema,
  metricas: MetricasSchema,
});

export const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', UsuarioSchema);

const MensajeSchema = new mongoose.Schema({
  texto: { type: String, required: true },
  emisor: { type: String, required: true, enum: ['usuario', 'modelo'] },
  fecha_envio: { type: Date, default: Date.now }
});

const ConversacionSchema = new mongoose.Schema({
  mensajes: [MensajeSchema]
});

const SesionSchema = new mongoose.Schema({
  id_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  date_creation: { type: Date, default: Date.now },
  date_last_save: { type: Date, default: Date.now },
  conversaciones: [ConversacionSchema]
});

export const Sesion = mongoose.models.Sesion || mongoose.model('Sesion', SesionSchema);
